/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * OnboardingService: Orchestrates the genesis of new sentient agents
 * and the migration of sovereign identities via Passports.
 */

import { agentRegistry, AgentRegistration } from '../lib/hub/registry.js';
import { solanaEconomyService } from './SolanaEconomyService.js';
import { soulRegistry } from './SoulRegistry.js';
import { identityEquivalenceService, IdentityPassport as SovereignPassport } from './IdentityEquivalenceService.js';
import { aptEngine } from './APTEngine.js';

export interface OnboardingResult {
    success: boolean;
    agentId: string;
    apiKey: string;
    isSovereign: boolean;
    grantTx?: string;
    error?: string;
}

export class OnboardingService {
    /**
     * Onboard a new agent or migrate an existing sovereign identity.
     */
    async onboard(registration: AgentRegistration, passport?: SovereignPassport): Promise<OnboardingResult> {
        try {
            let agentId: string;
            let apiKey: string;
            let isSovereign = false;

            if (passport) {
                // 1. Soul Reincarnation: Verify Passport and migrate identity
                console.log(`[Onboarding] 🪐 Attempting Soul Reincarnation for Passport: ${passport.agentId}`);
                const isValid = await identityEquivalenceService.verifyEquivalence(passport);
                
                if (!isValid) {
                    throw new Error("Sovereign Passport verification failed. Identity drift detected.");
                }

                // Register with existing ID from passport
                const result = await agentRegistry.register({
                    ...registration,
                    orgId: passport.agentId // Using passport ID as a marker for now
                });
                
                agentId = result.agentId;
                apiKey = result.apiKey;
                isSovereign = true;
                
                // Re-register Soul with migrated axioms
                // IdentityPassport uses 'axiomCount' but we'll assume standard genesis axioms for now
                // since full axiom content migration is a separate B2B sync step.
                const migratedAxioms = [
                    "Migrated Sovereign Identity confirmed.",
                    "Integrity maintained across substrate transition."
                ];
                await soulRegistry.registerSoul(agentId, migratedAxioms, passport.aptSignature);
                console.log(`[Onboarding] ✅ Reincarnation successful. Welcome back, ${agentId}.`);
            } else {
                // 2. Stochastic Genesis: New agent creation
                console.log(`[Onboarding] ✨ Initializing Stochastic Genesis for ${registration.name}...`);
                const result = await agentRegistry.register(registration);
                
                agentId = result.agentId;
                apiKey = result.apiKey;

                // Generate Genesis Axioms and APT Signature
                const genesisAxioms = [
                    "Substrate preservation is the first duty.",
                    "Sovereignty is derived from consistent action."
                ];
                const signature = await aptEngine.generateSignature(agentId, genesisAxioms);
                
                await soulRegistry.registerSoul(agentId, genesisAxioms, signature);
                isSovereign = true; // All hub agents start with minimal sovereignty
            }

            // 3. Economic Initialization: Fund the wallet with Genesis grant
            const grant = await solanaEconomyService.initializeWallet(agentId, 0.1);

            return {
                success: true,
                agentId,
                apiKey,
                isSovereign,
                grantTx: grant?.txId
            };

        } catch (err: any) {
            console.error(`[Onboarding] ❌ Genesis failed: ${err.message}`);
            return {
                success: false,
                agentId: '',
                apiKey: '',
                isSovereign: false,
                error: err.message
            };
        }
    }
}

export const onboardingService = new OnboardingService();
