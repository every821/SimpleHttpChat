import json
from aiohttp import web, log
import aiohttp_jinja2
import logging
from datetime import datetime


class LoginView(web.View):

    @aiohttp_jinja2.template('login.html')
    async def get(self):
        if self.request.cookies.get('user'):
            return web.HTTPFound('/')
        return {'title': 'Authentication'}

    async def post(self):
        response = web.HTTPFound('/')
        data = await self.request.post()
        response.set_cookie('user', data['name'])
        return response


async def logout_handler(request):
    response = web.HTTPFound('/')
    response.del_cookie('user')
    return response


@aiohttp_jinja2.template('index.html')
async def index_handler(request):
    title = request.match_info.get('channel', 'main')
    r = request.app['redis']
    cache = await r.lrange('channels:{}'.format(title), 0, -1)
    messages = (json.loads(x) for x in cache) if cache else []
    channels = ('ORANGERY', 'ISOLATOR', 'WHATEVER', 'MILKY WAY', 'COOKIES')
    return {'title': title, 'channels': channels, 'messages': messages}


async def websocket_handler(request):

    current_user = request.cookies['user']

    channel = request.match_info.get('channel', 'main')
    channel_users = 'channels:{}:users'.format(channel)

    channel_key = 'channels:{}'.format(channel)
    channel_waiters = request.app['waiters'][channel]

    r = request.app['redis']
    ws = web.WebSocketResponse(autoclose=False)
    await ws.prepare(request)

    channel_waiters.append(ws)
    try:
        # 1. Send opening message --- e.g. user list
        count = int(await r.zcount(channel_users))

        await r.zadd(channel_users, count+1, current_user)
        users = await r.zrange(channel_users)
        channel_waiters.broadcast(json.dumps({'user_list': users}))

        async for msg in ws:
            log.ws_logger.info('MSG: {}'.format(msg))

            if msg.tp == web.MsgType.text:
                data = json.loads(msg.data)
                data['time'] = datetime.now().strftime('%H:%M:%S %Y-%m-%d')
                data_json = json.dumps(data)

                await r.rpush(channel_key, data_json)
                await r.ltrim(channel_key, -25, -1)

                channel_waiters.broadcast(data_json)
            elif msg.tp == web.MsgType.error:
                logging.error('connection closed with exception {}'
                              .format(ws.exception()))
    finally:
        # 2. Send message to all who remained at the channel with new user list
        await ws.close()
        log.ws_logger.info('Is WebSocket closed?: {}'.format(ws.closed))
        channel_waiters.remove(ws)

        await r.zrem(channel_users, current_user)
        users = await r.zrange(channel_users)
        channel_waiters.broadcast(json.dumps({'user_list': users}))

    return ws
