(async function ({ eventData = {} }, initPlayer) {
  const result = initPlayer.handleEventWithTriggerListener('TRIGGER', eventData);
  if (result != null && typeof result.then === 'function') await result;
});
