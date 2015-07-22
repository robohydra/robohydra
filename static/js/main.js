function adjustHeader() {
    if ("scrollY" in window) {
        var navbar = document.getElementById("navbar");
        if (window.scrollY) {
            navbar.className = "navbar navbar-scrolled";
        } else {
            navbar.className = "navbar";
        }
    }
}

window.addEventListener("load", adjustHeader, false);
window.addEventListener("scroll", adjustHeader, false);
