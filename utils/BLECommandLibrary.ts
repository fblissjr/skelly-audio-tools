export const BLE_COMMANDS = {
  EYES_ON: { name: 'Eyes On', bytes: new Uint8Array([0x01, 0x01]) },
  EYES_OFF: { name: 'Eyes Off', bytes: new Uint8Array([0x01, 0x00]) },
  EYES_FLAMES: { name: 'Eye Flames', bytes: new Uint8Array([0x02, 0x01]) },
  JAW_OPEN: { name: 'Jaw Open', bytes: new Uint8Array([0x03, 0x01]) },
  JAW_CLOSE: { name: 'Jaw Close', bytes: new Uint8Array([0x03, 0x00]) },
  HEAD_UP: { name: 'Head Up', bytes: new Uint8Array([0x04, 0x01]) },
  HEAD_DOWN: { name: 'Head Down', bytes: new Uint8Array([0x04, 0x00]) },
};

export type CommandKey = keyof typeof BLE_COMMANDS;
