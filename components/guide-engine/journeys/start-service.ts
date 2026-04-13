import type { GuideJourney } from '../types/guide.types';

/**
 * Starting a Service
 *
 * data-testid targets used:
 *   display-setup-auto-assign-btn   — Auto-assign displays button
 *   display-setup-save-mapping-btn  — Save Mapping button
 *   display-setup-start-service-btn — Start Service button
 */
export const startServiceJourney: GuideJourney = {
  id: 'start-service',
  title: 'Starting a Service',
  description: 'Assign your screens, save the mapping, and launch the room in 3 steps.',
  mode: ['training'],
  category: 'live',
  audience: ['admin', 'media'],
  skippable: true,
  resumable: true,
  estimatedMinutes: 3,
  steps: [
    {
      id: 'intro',
      title: 'Start Service',
      description: 'Lumina moves your windows into position with one button.',
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: 'Starting a Service',
        body: "Lumina's Start Service feature moves the control window to your assigned control screen, opens audience output fullscreen on the audience screen, and opens the stage display on the stage screen — all at once.",
        showNext: true,
        showSkip: true,
        tone: 'info',
      },
    },
    {
      id: 'open-display-setup',
      title: 'Open Display Setup',
      description: 'Start Service lives in the Quick Actions panel.',
      target: {
        dataTestId: 'rightdock-start-service-btn',
        mustBeVisible: false,
        scrollIntoView: false,
        prerequisiteClick: 'header-right-dock-btn',
      },
      placement: 'left',
      action: 'observe',
      tooltip: {
        title: 'Quick Actions → Start Service',
        body: 'Click "Start Service" in the Quick Actions panel (the ✦ button top-right) to open the Display Setup modal where you configure and launch your screens.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'auto-assign',
      title: 'Auto Assign Displays',
      description: 'Let Lumina choose the best role for each connected screen.',
      target: {
        dataTestId: 'display-setup-auto-assign-btn',
        mustBeVisible: false,
        scrollIntoView: true,
        prerequisiteClick: 'rightdock-start-service-btn',
      },
      placement: 'bottom',
      action: 'observe',
      tooltip: {
        title: 'Auto Assign',
        body: "Click Auto Assign and Lumina will detect your screens and suggest roles — control for the laptop, audience for the projector, stage for the confidence monitor. You can always override manually.",
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'save-mapping',
      title: 'Save Mapping',
      description: 'Save the display roles so Lumina remembers them next time.',
      target: {
        dataTestId: 'display-setup-save-mapping-btn',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'top',
      action: 'observe',
      tooltip: {
        title: 'Save Mapping',
        body: 'Once your displays are assigned correctly, save the mapping. Lumina will remember which physical screen is which, so you only need to do this once per venue.',
        showBack: true,
        showNext: true,
        showSkip: true,
      },
    },
    {
      id: 'start-service',
      title: 'Start Service',
      description: 'Click Start Service to launch everything at once.',
      target: {
        dataTestId: 'display-setup-start-service-btn',
        mustBeVisible: false,
        scrollIntoView: true,
      },
      placement: 'top',
      action: 'observe',
      tooltip: {
        title: 'Start Service',
        body: 'This is the green button. It opens all three windows simultaneously and moves the control panel to the correct screen. Your team can start presenting immediately.',
        showBack: true,
        showNext: true,
        showSkip: true,
        tone: 'success',
      },
    },
    {
      id: 'done',
      title: 'Service launched',
      description: "All screens are in position — you're live.",
      placement: 'center',
      action: 'observe',
      tooltip: {
        title: "You're live",
        body: 'Your audience screen is showing output, the stage display is ready for your speakers, and you control everything from the Presenter view. Have a great service.',
        showBack: true,
        showNext: true,
        showSkip: false,
        tone: 'success',
      },
    },
  ],
  completion: { type: 'last-step' },
};
