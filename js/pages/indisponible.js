document.getElementById('btn-return').addEventListener('click', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const retour = urlParams.get('retour');
    
    if (retour) {
        window.location.href = decodeURIComponent(retour);
    } else {
        window.history.back();
    }
});
