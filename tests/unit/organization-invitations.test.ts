import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { db } from '../../src/db/client.js';
import { apiKeys, members, organizations, users } from '../../src/db/schema.js';
import { generateToken, verifyToken } from '../../lib/jwt.js';
import authRouter from '../../src/api/auth.js';
import governanceRouter from '../../src/api/governance.js';
import settingsHandler from '../../api/settings.js';

async function createOrganizationOwner(email: string) {
  const userId = randomUUID();
  const orgId = randomUUID();
  await db.insert(users).values({ id: userId, email, name: 'Org Owner', role: 'owner', plan: 'free' });
  await db.insert(organizations).values({ id: orgId, name: 'Invitation Test Org', plan: 'free' });
  await db.insert(members).values({ id: randomUUID(), userId, orgId, role: 'owner' });
  return { userId, orgId, token: generateToken({ id: userId, email, organization_id: orgId, role: 'owner' }) };
}

describe('organization invitations', () => {
  it('restores the last organization on login only when the user is still a member', async () => {
    const userId = randomUUID();
    const email = `${randomUUID()}@example.test`;
    const firstOrgId = randomUUID();
    const secondOrgId = randomUUID();
    await db.insert(users).values({
      id: userId, email, name: 'Multi-org User', passwordHash: await bcrypt.hash('secure-test-password', 4), role: 'owner', plan: 'free',
    });
    await db.insert(organizations).values({ id: firstOrgId, name: 'First Org', plan: 'free' });
    await db.insert(organizations).values({ id: secondOrgId, name: 'Second Org', plan: 'free' });
    await db.insert(members).values({ id: randomUUID(), userId, orgId: firstOrgId, role: 'owner' });
    await db.insert(members).values({ id: randomUUID(), userId, orgId: secondOrgId, role: 'member' });

    const selectedResponse = await authRouter.request('/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'secure-test-password', organizationId: secondOrgId }),
    });
    const selected = await selectedResponse.json();
    expect(selectedResponse.status).toBe(200);
    expect(selected.user.orgId).toBe(secondOrgId);
    expect(selected.user.role).toBe('member');
    expect(verifyToken(selected.token)).toMatchObject({ organizationId: secondOrgId, role: 'member' });

    const stalePreferenceResponse = await authRouter.request('/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'secure-test-password', organizationId: randomUUID() }),
    });
    const stalePreference = await stalePreferenceResponse.json();
    expect(stalePreferenceResponse.status).toBe(200);
    expect(stalePreference.user.orgId).toBe(firstOrgId);
    expect(verifyToken(stalePreference.token)).toMatchObject({ organizationId: firstOrgId, role: 'owner' });
  });

  it('lets an owner create a role-bound link that provisions a new member in that organization', async () => {
    const owner = await createOrganizationOwner(`${randomUUID()}@example.test`);
    const email = `${randomUUID()}@example.test`;
    const inviteResponse = await governanceRouter.request('/invitations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role: 'admin' }),
    });
    const inviteData = await inviteResponse.json();
    expect(inviteResponse.status).toBe(201);
    expect(inviteData.invitation.role).toBe('admin');
    const rawToken = new URL(inviteData.inviteUrl).searchParams.get('invite');
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/);

    const signupResponse = await authRouter.request('/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toUpperCase(), password: 'secure-test-password', name: 'New Admin', invitationToken: rawToken }),
    });
    const signupData = await signupResponse.json();
    expect(signupResponse.status).toBe(201);
    expect(signupData.user.role).toBe('admin');
    expect(signupData.user.orgId).toBe(owner.orgId);
    expect(verifyToken(signupData.token)).toMatchObject({ userId: signupData.user.id, organizationId: owner.orgId, role: 'admin' });

    const orgMembers = await db.select().from(members);
    expect(orgMembers.find((member: any) => member.userId === signupData.user.id)).toMatchObject({ orgId: owner.orgId, role: 'admin' });
    const duplicateSignup = await authRouter.request('/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'secure-test-password', invitationToken: rawToken }),
    });
    expect(duplicateSignup.status).toBe(400);
  });

  it('requires a live owner/admin membership to create an invitation', async () => {
    const owner = await createOrganizationOwner(`${randomUUID()}@example.test`);
    const memberId = randomUUID();
    const memberEmail = `${randomUUID()}@example.test`;
    await db.insert(users).values({ id: memberId, email: memberEmail, name: 'Regular Member', role: 'member' });
    await db.insert(members).values({ id: randomUUID(), userId: memberId, orgId: owner.orgId, role: 'member' });
    const memberToken = generateToken({ id: memberId, email: memberEmail, organization_id: owner.orgId, role: 'member' });
    const response = await governanceRouter.request('/invitations', {
      method: 'POST', headers: { Authorization: `Bearer ${memberToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `${randomUUID()}@example.test`, role: 'admin' }),
    });
    expect(response.status).toBe(403);
  });

  it('cancels an invitation and prevents its link from provisioning an account', async () => {
    const owner = await createOrganizationOwner(`${randomUUID()}@example.test`);
    const email = `${randomUUID()}@example.test`;
    const created = await governanceRouter.request('/invitations', {
      method: 'POST', headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role: 'member' }),
    });
    const inviteData = await created.json();
    const rawToken = new URL(inviteData.inviteUrl).searchParams.get('invite');
    const canceled = await governanceRouter.request(`/invitations/${inviteData.invitation.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${owner.token}` },
    });
    const canceledData = await canceled.json();
    expect(canceled.status).toBe(200);
    const signup = await authRouter.request('/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'secure-test-password', invitationToken: rawToken }),
    });
    expect(signup.status).toBe(400);
  });

  it('lets an existing account accept an invite, switch organization context, and issue a scoped member key', async () => {
    const owner = await createOrganizationOwner(`${randomUUID()}@example.test`);
    const existingUserId = randomUUID();
    const existingEmail = `${randomUUID()}@example.test`;
    const existingOrgId = randomUUID();
    await db.insert(users).values({ id: existingUserId, email: existingEmail, name: 'Existing User', role: 'owner', plan: 'free' });
    await db.insert(organizations).values({ id: existingOrgId, name: 'Existing Account Org', plan: 'free' });
    await db.insert(members).values({ id: randomUUID(), userId: existingUserId, orgId: existingOrgId, role: 'owner' });

    const inviteResponse = await governanceRouter.request('/invitations', {
      method: 'POST', headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: existingEmail, role: 'admin' }),
    });
    const inviteData = await inviteResponse.json();
    const inviteToken = new URL(inviteData.inviteUrl).searchParams.get('invite');
    const existingToken = generateToken({ id: existingUserId, email: existingEmail, organization_id: existingOrgId, role: 'owner' });
    const acceptResponse = await governanceRouter.request('/invitations/accept', {
      method: 'POST', headers: { Authorization: `Bearer ${existingToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: inviteToken }),
    });
    const accepted = await acceptResponse.json();
    expect(acceptResponse.status).toBe(200);
    expect(accepted.user.orgId).toBe(owner.orgId);
    expect(accepted.user.role).toBe('admin');
    expect(verifyToken(accepted.token)).toMatchObject({ organizationId: owner.orgId, role: 'admin' });

    const keyResponse = await settingsHandler({
      method: 'POST', url: '/api/settings',
      headers: { authorization: `Bearer ${accepted.token}` },
      body: { action: 'create_key' },
    });
    const keyData = await keyResponse.json();
    expect(keyResponse.status).toBe(201);
    const keyRows = await db.select().from(apiKeys);
    expect(keyRows.find((row: any) => row.id === keyData.key.id)).toMatchObject({ userId: existingUserId, orgId: owner.orgId });
  });
});
