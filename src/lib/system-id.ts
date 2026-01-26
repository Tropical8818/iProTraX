import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const ID_FILE = path.join(DATA_DIR, 'machine-id');

/**
 * Gets or creates a persistent Machine ID.
 * This ID is stored in data/machine-id and survives restarts.
 */
export function getMachineId(): string {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(ID_FILE)) {
        return fs.readFileSync(ID_FILE, 'utf-8').trim();
    }

    // Generate new secure UUID
    const newId = crypto.randomUUID();
    fs.writeFileSync(ID_FILE, newId);
    return newId;
}

/**
 * Generates a Hardware Fingerprint string.
 * Format: MACHINE_ID|CPU_MODEL|CORE_COUNT|TOTAL_MEM|MAC_ADDR
 */
export function getSystemFingerprint(): string {
    const machineId = getMachineId();

    const cpu = os.cpus()[0]?.model || 'unknown-cpu';
    const cores = os.cpus().length;
    const mem = os.totalmem(); // Bytes

    // Get MAC address of first non-internal interface
    const nets = os.networkInterfaces();
    let mac = '00:00:00:00:00:00';

    for (const name of Object.keys(nets)) {
        const net = nets[name];
        if (net) {
            for (const iface of net) {
                if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
                    mac = iface.mac;
                    break;
                }
            }
        }
        if (mac !== '00:00:00:00:00:00') break;
    }

    // Combine into a raw string
    // The WASM verifier will hash this.
    // We strictly define the format here.
    return `${machineId}|${cpu}|${cores}|${mem}|${mac}`;
}
