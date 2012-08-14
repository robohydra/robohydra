document.addEventListener('DOMContentLoaded', function() {
    console.log("Document loaded");
    document.getElementById('newHeadType').addEventListener('change', function() {
        console.log("New head type changed!");
        var extraPropBoxes = document.getElementsByClassName('new-head-props');
        for (var i = 0, len = extraPropBoxes.length; i < len; i++) {
            if (extraPropBoxes[i].className.indexOf('new-head-props-' + this.value) !== -1) {
                extraPropBoxes[i].style.display = '';
            } else {
                extraPropBoxes[i].style.display = 'none';
            }
        }
    }, false);
}, false);
