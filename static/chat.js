
window.onload = function(){
    var form = document.getElementById('messageform');

    form.onsubmit = function(e){
        socket.send_message(form);
        return false;
    };
    form.onkeypress = function(e){
        if (e.keyCode == 13) {
            socket.send_message(form);
            return false;
        }
    };
    inbox = document.getElementById('inbox');
    inbox.scrollTop = inbox.scrollHeight;
    document.getElementById('message').select();
};

window.onclose = function(){
    socket.close(1000);
};

var SocketHandler = function() {
    var title = document.getElementById('channel').getAttribute('data-title');
    var url = "ws://" + location.host + "/chat/" + title + '/';

    var sock = new WebSocket(url);
    var intervalId;
    sock.onopen = function(){
        /*intervalId = setInterval(function(){sock.send('close');}, 150000);*/
    };
    sock.onmessage = function(event) {
        var message = JSON.parse(event.data);
        var parent = document.getElementById(message.parent);

        if (message.hasOwnProperty('user_list')){
            var parent = document.getElementById('user_list');

            while (parent.hasChildNodes()) {
                parent.removeChild(parent.lastChild);
            }

            parent.appendChild(make_user_list_members(message.user_list));
        }
        else if (message.hasOwnProperty('time')){
            var parent = document.getElementById('inbox');
            parent.appendChild(make_message_block(message));
            parent.scrollTop = parent.scrollHeight;
        }
    };
    sock.onclose = function(event){
        clearInterval(intervalId);
        console.log(event); // delete in production
        var ulist = document.getElementById('user_list');
        ulist.innerHTML = '<h4>Information unavailable</h4>';
        var error_span = document.getElementById('error');
        error_span.innerHTML = 'Sorry! Server has closed the connection!';
    };
    this.send_message = function(form){
        var elements = form.elements;
        var data = {};
        var i = 0;
        for (i; i < elements.length; i++){
            if (elements[i].type != 'submit'){
                data[elements[i].name] = elements[i].value;
            }
        }
        sock.send(JSON.stringify(data));
        var input = form.querySelector("input[type=text]");
        input.value = '';
        input.select();
    };
};

function make_user_list_members(arr){
    var block = document.createElement('div');
    block.className = "ui header list right aligned blue";
    var i = 0;
    for (i; i< arr.length; i ++){
        var innerBlock = document.createElement('div');
        innerBlock.className = "item";
        var b = document.createElement('b');
        b.className = "red";
        b.innerHTML = arr[i];
        innerBlock.appendChild(b);
        block.appendChild(innerBlock);
    }
    return block;
};

function make_message_block(message){

    var span = document.createElement('span');
    span.className = "sub header";
    span.innerHTML = message.time;

    var header = document.createElement('div');
    header.className = "ui header tiny right aligned blue";
    header.innerHTML = message.user;
    header.appendChild(span);

    var column0 = document.createElement('div');
    column0.className = "four wide column";
    column0.appendChild(header);

    var column1 = document.createElement('div');
    column1.className = "twelve wide column";
    column1.style.wordWrap = 'break-word';
    column1.innerHTML = message.body;

    var innerBlock = document.createElement('div');
    innerBlock.className = "ui stackable grid";
    innerBlock.appendChild(column0);
    innerBlock.appendChild(column1);

    var block = document.createElement('div');
    block.className = "ui segment";
    block.appendChild(innerBlock);

    return block;
}

var socket = new SocketHandler();
