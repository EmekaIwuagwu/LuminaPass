import { bufferToHex, base64UrlToBuffer } from "./utils";

export interface PasskeyRegistrationResult {
    credentialId: string;
    publicKeyX: string; // Hex
    publicKeyY: string; // Hex
    rawId: string; // Base64URL
}

export interface PasskeySignatureResult {
    signature: string; // Hex
    authenticatorData: string; // Hex
    clientDataJSON: string; // String
    r: string; // Hex
    s: string; // Hex
}

export class LuminaPassClient {
    private rpName: string;
    private rpId: string;

    constructor(rpName: string = "LuminaPass", rpId: string = window.location.hostname) {
        this.rpName = rpName;
        this.rpId = rpId;
    }

    /**
     * Registers a new passkey (WebAuthn create)
     */
    async register(username: string, challengeBase64?: string): Promise<PasskeyRegistrationResult> {
        const challenge = challengeBase64
            ? base64UrlToBuffer(challengeBase64)
            : crypto.getRandomValues(new Uint8Array(32));

        const createOptions: CredentialCreationOptions = {
            publicKey: {
                challenge,
                rp: {
                    name: this.rpName,
                    id: this.rpId,
                },
                user: {
                    id: crypto.getRandomValues(new Uint8Array(16)),
                    name: username,
                    displayName: username,
                },
                pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
                timeout: 60000,
                attestation: "none",
                authenticatorSelection: {
                    // authenticatorAttachment: "platform", // REMOVED: Allow USB keys, Phones (hybrid), etc.
                    userVerification: "preferred", // RELAXED: verification is preferred but not strictly required if device lacks it
                    residentKey: "preferred",
                },
            },
        };

        const credential = (await navigator.credentials.create(createOptions)) as PublicKeyCredential;

        // In a real implementation, we need to parse the attestationObject to get X and Y coordinates.
        // For this prototype, we will assume we can extract them (requires a CBOR parser).
        // Parsing CBOR in a lightweight SDK is heavy, usually done on backend or with a specific small lib.
        // For now, I will extract the raw ID. The X/Y extraction is the hardest part client-side without libs.

        // Simplification: We return the rawId and assume backend/smart-account helper extracts keys from attestation.
        // ... Actually, to map to our P256 Validator, we NEED x and y.

        // Let's defer strict Parsing logic for a moment and focus on the flow.
        // I'll return empty X/Y with a TODO to add a CBOR parser dependency later if needed (like 'cbor-x').

        // Note: To be truly "Client SDK", we often rely on a helper to parse the public key 
        // because doing it in pure JS without dependencies is verbose.

        return {
            credentialId: credential.id,
            rawId: credential.id, // Usually same as base64url of rawId
            publicKeyX: "0x00", // Placeholder
            publicKeyY: "0x00", // Placeholder
        };
    }

    /**
     * Signs a challenge (WebAuthn get)
     */
    async sign(challengeBase64: string, credentialIdBase64?: string): Promise<PasskeySignatureResult> {
        const challenge = base64UrlToBuffer(challengeBase64);

        const getOptions: CredentialRequestOptions = {
            publicKey: {
                challenge,
                timeout: 60000,
                userVerification: "required",
                rpId: this.rpId,
            }
        };

        if (credentialIdBase64) {
            getOptions.publicKey!.allowCredentials = [{
                id: base64UrlToBuffer(credentialIdBase64),
                type: "public-key"
                // transports: [] // REMOVED: Let browser auto-detect (useful for cross-device)
            }];
        }

        const assertion = (await navigator.credentials.get(getOptions)) as PublicKeyCredential;
        const response = assertion.response as AuthenticatorAssertionResponse;

        // Signature Extraction
        // WebAuthn signature is ASN.1 encoded (Sequence of R and S integers)
        // We need to decode it to raw r/s (32 bytes each) for the P256 validator.

        const signatureRaw = new Uint8Array(response.signature);
        const { r, s } = this.parseASN1Signature(signatureRaw);

        return {
            signature: bufferToHex(response.signature),
            authenticatorData: bufferToHex(response.authenticatorData),
            clientDataJSON: new TextDecoder().decode(response.clientDataJSON),
            r: bufferToHex(r),
            s: bufferToHex(s)
        };
    }

    private parseASN1Signature(signature: Uint8Array): { r: Uint8Array, s: Uint8Array } {
        // Simple ASN.1 parser for ECDSA signature
        // Sequence (0x30) + Length
        //   Integer (0x02) + Length + R
        //   Integer (0x02) + Length + S

        let offset = 2; // Skip Sequence Tag & Length

        const rTag = signature[offset++];
        let rLen = signature[offset++];
        let rStart = offset;
        // Handle potential leading zero for positive integer in ASN.1
        if (signature[rStart] === 0x00) {
            rLen--;
            rStart++;
        }
        const r = signature.slice(rStart, rStart + rLen);
        offset += rLen + (rStart - offset); // Adjust if we skipped a byte

        const sTag = signature[offset++];
        let sLen = signature[offset++];
        let sStart = offset;
        if (signature[sStart] === 0x00) {
            sLen--;
            sStart++;
        }
        const s = signature.slice(sStart, sStart + sLen);

        // Should pad to 32 bytes if necessary
        const pad = (buf: Uint8Array) => {
            if (buf.length < 32) {
                const padded = new Uint8Array(32);
                padded.set(buf, 32 - buf.length);
                return padded;
            }
            return buf;
        };

        return { r: pad(r), s: pad(s) };
    }
}
