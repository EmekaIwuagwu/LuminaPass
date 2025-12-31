import './style.css'
import { LuminaPassClient } from '@lumina/sdk';

// Initialize SDK
const client = new LuminaPassClient("LuminaPass Demo", window.location.hostname);

// UI Elements
const usernameInput = document.getElementById('username') as HTMLInputElement;
const btnRegister = document.getElementById('btn-register') as HTMLButtonElement;
const btnSign = document.getElementById('btn-sign') as HTMLButtonElement;
const btnLogout = document.getElementById('btn-logout') as HTMLButtonElement;
const usernameStep = document.getElementById('username-step') as HTMLDivElement;
const actionStep = document.getElementById('action-step') as HTMLDivElement;
const userDisplay = document.getElementById('user-display') as HTMLSpanElement;
const logArea = document.getElementById('logs') as HTMLDivElement;

// State
let currentCredentialId: string | null = null;
let currentUsername: string | null = null;

function log(msg: string, type: 'info' | 'error' | 'success' = 'info') {
  const el = document.createElement('div');
  el.textContent = `> ${msg}`;
  if (type === 'error') el.style.color = 'var(--error)';
  if (type === 'success') el.style.color = 'var(--success)';
  logArea.appendChild(el);
  logArea.scrollTop = logArea.scrollHeight;
}

// Handlers
btnRegister.addEventListener('click', async () => {
  const username = usernameInput.value;
  if (!username) return log('Please enter a username', 'error');

  try {
    log(`Creating passkey for ${username}...`);
    // Actual SDK Call
    const result = await client.register(username);

    currentCredentialId = result.credentialId;
    currentUsername = username;

    log('Passkey Created!', 'success');
    log(`CredID: ${result.credentialId.slice(0, 10)}...`);

    // Transition UI
    showActionStep();
  } catch (e: any) {
    log(`Error: ${e.message}`, 'error');
    console.error(e);
  }
});

btnSign.addEventListener('click', async () => {
  if (!currentCredentialId) return log('No credential found', 'error');

  try {
    log('Please authenticate to sign...', 'info');
    // Random challenge (usually from server)
    const challenge = btoa("random-challenge-" + Date.now());

    // Actual SDK Call
    const sig = await client.sign(challenge, currentCredentialId);

    log('Signature Verified (Mock)!', 'success');
    log(`Sig: ${sig.signature.slice(0, 20)}...`);
    log(`r: ${sig.r}`);
    log(`s: ${sig.s}`);
  } catch (e: any) {
    log(`Error: ${e.message}`, 'error');
  }
});

btnLogout.addEventListener('click', () => {
  currentCredentialId = null;
  currentUsername = null;
  usernameInput.value = '';
  usernameStep.classList.remove('hidden');
  actionStep.classList.add('hidden');
  log('Logged out.');
});

function showActionStep() {
  usernameStep.classList.add('hidden');
  actionStep.classList.remove('hidden');
  userDisplay.textContent = `@${currentUsername}`;
}
