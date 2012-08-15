document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('newHeadType').addEventListener('change', function() {
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
