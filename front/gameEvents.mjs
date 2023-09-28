const events = {};
function addEvents(self) {
  // все эти манипуляциии для того, чтобы внутри функций в self остался vue-компонент, но при этом сохранилась бы ссылка на функцию для корректного удаления ее в removeEvents
  Object.assign(events, {
    async handleGameApi(event) {
      if (event.target.classList.contains('active-event')) {
        await self.handleGameApi({
          name: 'eventTrigger',
          data: { eventData: { targetId: event.target.attributes.id?.value } },
        });
      }
    },
  });
  
  document.body.addEventListener('click', events.handleGameApi);
}

function removeEvents() {
  document.body.removeEventListener('click', events.handleGameApi);
}

export { addEvents, removeEvents, events };
