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

    /** Toogle description element visibility **/
    var toggleDescription = function(){
        var obj = document.getElementById( this.id.replace('holder_', '') );

        if(obj.className.indexOf(' closed') != -1) {
            obj.className = obj.className.replace(' closed', '');
        }else{
            obj.className += ' closed';
        }
    };

    var descriptionTags = document.getElementsByClassName('description holder');
    for(var i=0;i<descriptionTags.length; i++){
        descriptionTags[i].addEventListener('click', toggleDescription);
    }
}, false);