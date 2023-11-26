const events = {};
function addEvents(self) {
  // все эти манипуляциии для того, чтобы внутри функций в self остался vue-компонент, но при этом сохранилась бы ссылка на функцию для корректного удаления ее в removeEvents
  Object.assign(events, {});
}

function removeEvents() {}

export { addEvents, removeEvents, events };
