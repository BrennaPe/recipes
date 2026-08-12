document.addEventListener("DOMContentLoaded", function () {

    const popup = document.getElementById("muscle-popup");
    const yesButton = document.getElementById("muscle-yes");
    const noButton = document.getElementById("muscle-no");

    // YES → close popup and continue to website
    yesButton.addEventListener("click", function () {
        popup.style.display = "none";
    });

    // NO → try to close the browser window
    noButton.addEventListener("click", function () {

        window.close();

        // Browsers normally prevent websites from closing
        // tabs that they didn't open themselves.
        setTimeout(function () {
            document.body.innerHTML = "";
            document.body.style.background = "#000";
        }, 100);

    });

});