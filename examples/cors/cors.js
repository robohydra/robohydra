window.addEventListener("load", function() {
    var getReq = new XMLHttpRequest();
    getReq.onload = function() {
        var testGetDiv = document.getElementById("test-get");
        testGetDiv.textContent = this.responseText;
    };
    getReq.open("GET", "http://localhost:3000/get");
    getReq.send();

    var postReq = new XMLHttpRequest();
    postReq.onload = function() {
        var testPostDiv = document.getElementById("test-post");
        testPostDiv.textContent = this.responseText;
    };
    postReq.open("POST", "http://localhost:3000/post");
    postReq.send("This is some example payload");
}, false);
