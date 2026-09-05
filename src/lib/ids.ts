import { customAlphabet } from 'nanoid';

const alpha = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

export const newId = (prefix: string) => `${prefix}_${alpha()}`;

export const newPartId = () => newId('p');
export const newWireId = () => newId('w');
export const newNoteId = () => newId('n');
export const newDesignId = () => newId('d');
