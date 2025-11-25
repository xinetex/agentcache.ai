import React, { useState } from 'react';
import { TrustCenter } from '../infrastructure/TrustCenter';

export default function GovWizard() {
    const [step, setStep] = useState(1);
    const [config, setConfig] = useState({
        agency: '',
        mission: 'Scientific Discovery',
        impactLevel: 'IL4',
        compliance: {
            fedramp: true,
            hipaa: false,
            neutrality: true
        }
    });

    const handleNext = () => setStep(step + 1);
    const handleBack = () => setStep(step - 1);

    const handleFinish = async () => {
        // In a real app, we would call the backend API
        // const trustCenter = new TrustCenter();
        // await trustCenter.configureGovernmentMode(config);
        setStep(4);
    };

    return (
        <div className="bg-slate-800 rounded-lg overflow-hidden shadow-xl max-w-2xl w-full mx-auto border border-slate-700">
            {/* Step 1: Profile */}
            {step === 1 && (
                <div className="p-6">
                    <h3 className="text-lg font-medium text-white mb-4">Step 1: Agency Profile</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Agency Name</label>
                            <input
                                type="text"
                                className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                                placeholder="e.g. Department of Energy"
                                onChange={(e) => setConfig({ ...config, agency: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300">Mission Area</label>
                            <select
                                className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                                onChange={(e) => setConfig({ ...config, mission: e.target.value })}
                            >
                                <option>Scientific Discovery (Genesis Mission)</option>
                                <option>National Security</option>
                                <option>Citizen Services</option>
                            </select>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button onClick={handleNext} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Next</button>
                    </div>
                </div>
            )}

            {/* Step 2: Security Level */}
            {step === 2 && (
                <div className="p-6">
                    <h3 className="text-lg font-medium text-white mb-4">Step 2: Security Impact Level</h3>
                    <div className="grid grid-cols-3 gap-4">
                        {['IL2', 'IL4', 'IL5'].map((level) => (
                            <div
                                key={level}
                                onClick={() => setConfig({ ...config, impactLevel: level })}
                                className={`p-4 rounded border cursor-pointer ${config.impactLevel === level ? 'border-blue-500 bg-slate-700' : 'border-slate-600 hover:border-blue-400'}`}
                            >
                                <div className="font-bold text-white">{level}</div>
                                <div className="text-xs text-slate-400">
                                    {level === 'IL2' ? 'Public Data' : level === 'IL4' ? 'CUI / PII' : 'Mission Critical'}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 flex justify-between">
                        <button onClick={handleBack} className="text-slate-300 hover:text-white">Back</button>
                        <button onClick={handleNext} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Next</button>
                    </div>
                </div>
            )}

            {/* Step 3: Compliance */}
            {step === 3 && (
                <div className="p-6">
                    <h3 className="text-lg font-medium text-white mb-4">Step 3: Compliance Frameworks</h3>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-3">
                            <input type="checkbox" checked disabled className="form-checkbox h-5 w-5 text-blue-600" />
                            <span className="text-white">FedRAMP (NIST 800-53)</span>
                        </label>
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={config.compliance.hipaa}
                                onChange={(e) => setConfig({ ...config, compliance: { ...config.compliance, hipaa: e.target.checked } })}
                                className="form-checkbox h-5 w-5 text-blue-600"
                            />
                            <span className="text-white">HIPAA / HITECH</span>
                        </label>
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={config.compliance.neutrality}
                                onChange={(e) => setConfig({ ...config, compliance: { ...config.compliance, neutrality: e.target.checked } })}
                                className="form-checkbox h-5 w-5 text-blue-600"
                            />
                            <span className="text-white">Viewpoint Neutrality Mandate</span>
                        </label>
                    </div>
                    <div className="mt-6 flex justify-between">
                        <button onClick={handleBack} className="text-slate-300 hover:text-white">Back</button>
                        <button onClick={handleFinish} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Configure Workspace</button>
                    </div>
                </div>
            )}

            {/* Step 4: Success */}
            {step === 4 && (
                <div className="p-6 text-center">
                    <div className="text-green-500 text-5xl mb-4">✓</div>
                    <h3 className="text-xl font-bold text-white">Workspace Configured</h3>
                    <p className="text-slate-400 mt-2">Your secure environment is ready.</p>
                    <div className="mt-6">
                        <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">Enter Workspace</button>
                    </div>
                </div>
            )}
        </div>
    );
}
