import { nanoid } from 'nanoid';
import type { MacroDefinition } from '../types/macros';

const now = new Date().toISOString();

const make = (
  partial: Omit<MacroDefinition, 'id' | 'scope' | 'isEnabled' | 'isTemplate' | 'tags' | 'createdAt' | 'updatedAt'>,
): MacroDefinition => ({
  id: nanoid(),
  scope: 'workspace',
  isEnabled: true,
  isTemplate: true,
  tags: [],
  createdAt: now,
  updatedAt: now,
  ...partial,
});

export const STARTER_MACROS: MacroDefinition[] = [
  // 1. Start Service
  make({
    name: 'Start Service',
    description: 'Clears the output and moves to the first run sheet item to open the service.',
    category: 'service_flow',
    triggers: [{ type: 'manual' }],
    actions: [
      {
        id: nanoid(), type: 'clear_output', payload: {},
        label: 'Clear output',
      },
      {
        id: nanoid(), type: 'go_to_item',
        payload: { itemId: '__FIRST_ITEM__', itemTitle: 'First item' },
        label: 'Go to first item',
        continueOnError: true,
      },
    ],
  }),

  // 2. Worship Mode
  make({
    name: 'Worship Mode',
    description: 'Activates worship layout: stage message cleared, first song item selected.',
    category: 'worship',
    triggers: [{ type: 'manual' }],
    actions: [
      { id: nanoid(), type: 'hide_message', payload: {}, label: 'Clear stage message' },
    ],
  }),

  // 3. Sermon Start
  make({
    name: 'Sermon Start',
    description: 'Clears lyrics, starts speaker timer, and advances to sermon item.',
    category: 'sermon',
    triggers: [{ type: 'manual' }],
    actions: [
      { id: nanoid(), type: 'hide_message', payload: {}, label: 'Clear stage message' },
      {
        id: nanoid(), type: 'start_timer',
        payload: { durationSec: 2400, label: 'Sermon' },
        label: 'Start 40-min sermon timer',
      },
    ],
  }),

  // 4. Scripture Reading
  make({
    name: 'Scripture Reading',
    description: 'Clears output and shows a brief stage message for the congregation to open their Bibles.',
    category: 'sermon',
    triggers: [{ type: 'manual' }],
    actions: [
      { id: nanoid(), type: 'clear_output', payload: {}, label: 'Clear output' },
      {
        id: nanoid(), type: 'show_message',
        payload: { text: 'Please open your Bibles', durationMs: 8000 },
        label: 'Show Bible prompt on stage',
      },
    ],
  }),

  // 5. Altar Call
  make({
    name: 'Altar Call',
    description: 'Clears the output for altar call atmosphere.',
    category: 'worship',
    triggers: [{ type: 'manual' }],
    actions: [
      { id: nanoid(), type: 'stop_timer', payload: {}, label: 'Stop speaker timer' },
      { id: nanoid(), type: 'clear_output', payload: {}, label: 'Clear main output' },
      {
        id: nanoid(), type: 'show_message',
        payload: { text: 'Come as you are', durationMs: 0 },
        label: 'Show altar call message on stage',
      },
    ],
  }),

  // 6. Prayer Moment
  make({
    name: 'Prayer Moment',
    description: 'Pauses flow — clears output and prompts stage to bow in prayer.',
    category: 'service_flow',
    triggers: [{ type: 'manual' }],
    actions: [
      { id: nanoid(), type: 'clear_output', payload: {}, label: 'Clear output' },
      {
        id: nanoid(), type: 'show_message',
        payload: { text: 'Let us pray', durationMs: 0 },
        label: 'Stage: Let us pray',
      },
    ],
  }),

  // 7. Emergency Clear
  make({
    name: 'Emergency Clear',
    description: 'Panic button — immediately clears all outputs, stops timer, and hides all messages.',
    category: 'emergency',
    triggers: [{ type: 'manual' }],
    requiresConfirmation: false,
    actions: [
      { id: nanoid(), type: 'hide_message', payload: {}, label: 'Hide stage message' },
      { id: nanoid(), type: 'stop_timer', payload: {}, label: 'Stop timer' },
      { id: nanoid(), type: 'clear_output', payload: {}, label: 'Clear main output' },
    ],
  }),

  // 8. End Service
  make({
    name: 'End Service',
    description: 'Closes the service: stops timer, hides messages, and clears audience output.',
    category: 'service_flow',
    triggers: [{ type: 'manual' }],
    actions: [
      { id: nanoid(), type: 'stop_timer', payload: {}, label: 'Stop speaker timer' },
      { id: nanoid(), type: 'hide_message', payload: {}, label: 'Clear stage message' },
      { id: nanoid(), type: 'clear_output', payload: {}, label: 'Clear audience output' },
    ],
  }),
];
