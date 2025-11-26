import React from 'react';
import ReactDOM from 'react-dom/client';
import GovWizardPremium from './components/GovWizardPremium';
import Sentinel3D from './components/Sentinel3D';
import SentinelHUD from './components/SentinelHUD';
import './components/GovWizardPremium.css'; // Ensure styles are loaded

// Mount Sentinel Dashboard
const sentinelRoot = document.getElementById('sentinel-root');
if (sentinelRoot) {
    ReactDOM.createRoot(sentinelRoot).render(
        <React.Fragment>
            <Sentinel3D />
            <SentinelHUD />
        </React.Fragment>
    );
}

// Expose wizard starter to window for the HTML button
window.startWizard = function () {
    const wizardRoot = document.getElementById('wizard-root');
    if (wizardRoot) {
        const root = ReactDOM.createRoot(wizardRoot);
        root.render(
            <GovWizardPremium
                onClose={() => root.unmount()}
                onComplete={(config) => {
                    console.log("Provisioning Complete:", config);
                    root.unmount();
                    alert("Workspace Provisioned: " + config.agency.name);
                }}
            />
        );
    }
};
