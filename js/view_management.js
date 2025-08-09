// --- GENEL GÖRÜNÜM YÖNETİMİ FONKSİYONLARI ---

function hideAllControlPanels() {
    const panels = ['initial-route-view', 'route-creation-form-content', 'driver-management-view', 'settings-view', 'tour-archive-view'];
    panels.forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.add('d-none');
        }
    });
}

function showMainPanelView() {
    hideAllControlPanels();
    document.getElementById('initial-route-view').classList.remove('d-none');
}

function showRouteCreationFormContent() {
    hideAllControlPanels();
    const routeFormContent = document.getElementById('route-creation-form-content');

    if (routeFormContent) {
        routeFormContent.classList.remove('d-none');
    }
    document.getElementById('pane-controls').scrollTop = 0;
}

function hideRouteCreationFormContent() {
    hideAllControlPanels();

    const initialRouteView = document.getElementById('initial-route-view');
    if (initialRouteView) {
        initialRouteView.classList.remove('d-none');
    }

    resetRouteCreationFormContent();
}

function showPalletLoaderView() {
    hideRightPanelViews();  
    document.getElementById('tour-plan-view').classList.remove('d-none');
}

function hideRightPanelViews() {
    const panels = ['tour-plan-view', 'market-management-view'];
    panels.forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.add('d-none');
        }
    });
}
