const config = {
  isRotating: false,
  initialRotateAngle: 0,
  rotation: 0,
  rotationLast: 0,
  isDragging: false,
  isTouchMoved: false,
  currentX: 0,
  currentY: 0,
  initialX: 0,
  initialY: 0,
  distanceX: 0,
  distanceY: 0,
  initialDistance: 0,
  xOffset: 0,
  yOffset: 0,
};

const events = {};
function addMouseEvents(self) {
  // все эти манипуляциии для того, чтобы внутри функций в self остался vue-компонент, но при этом сохранилась бы ссылка на функцию для корректного удаления ее в removeMouseEvents
  Object.assign(events, {
    mouseUp(event) {
      if (event.button === 2) {
        config.rotationLast = config.rotation;
        config.isRotating = false;
      } else {
        config.isDragging = false;
      }
    },
    mouseDown(event) {
      if (event.target.closest('.scroll-off')) return;
      if (event.button === 2) {
        config.initialRotateAngle = event.clientX;
        config.isRotating = true;
      } else {
        config.initialX = event.clientX - config.xOffset;
        config.initialY = event.clientY - config.yOffset;
        config.isDragging = true;
      }
    },
    mouseMove(event) {
      if (config.isRotating) {
        config.rotation = config.rotationLast + (event.clientX - config.initialRotateAngle) / 2;
        self.gameCustom.gamePlaneRotation = config.rotation;
      }
      if (config.isDragging) {
        config.currentX = event.clientX - config.initialX;
        config.currentY = event.clientY - config.initialY;

        config.xOffset = config.currentX;
        config.yOffset = config.currentY;

        self.updateGamePlaneTranslate({ x: config.currentX, y: config.currentY });
      }
    },
    touchStart(event) {
      if (event.target.closest('.scroll-off')) return;
      const touches = event.touches;
      if (touches.length === 2) {
        const [touch1, touch2] = touches;
        config.initialDistance = Math.hypot(touch1.pageX - touch2.pageX, touch1.pageY - touch2.pageY);

        config.rotationLast = config.rotation;
        config.initialRotateAngle = Math.atan2(touch2.pageY - touch1.pageY, touch2.pageX - touch1.pageX);
      } else {
        config.initialX = touches[0].pageX;
        config.initialY = touches[0].pageY;
        config.xOffset = self.gameCustom.gamePlaneTranslateX;
        config.yOffset = self.gameCustom.gamePlaneTranslateY;
        config.isTouchMoved = false;
      }
    },
    touchMove(event) {
      if (event.target.closest('.scroll-off')) return;
      const touches = event.touches;
      if (touches.length === 2) {
        const [touch1, touch2] = touches;
        const distance = Math.hypot(touch1.pageX - touch2.pageX, touch1.pageY - touch2.pageY);
        const delta = distance / config.initialDistance;

        const angle = Math.atan2(touch2.pageY - touch1.pageY, touch2.pageX - touch1.pageX);
        config.rotation = config.rotationLast + ((angle - config.initialRotateAngle) * 180) / Math.PI;
        self.gameCustom.gamePlaneRotation = config.rotation;

        // имитируем плавность
        if (delta < 0.5 || delta > 2) return;
        else config.initialDistance = distance;
        const scale = (delta - 1) * 0.5;
        if (self.gamePlaneScale + scale > 0.5) return;
        if (self.gamePlaneScale + scale < 0.2) return;
        self.gamePlaneScale += scale;
      } else {
        config.currentX = event.touches[0].pageX;
        config.currentY = event.touches[0].pageY;
        config.distanceX = config.currentX - config.initialX;
        config.distanceY = config.currentY - config.initialY;

        if (Math.abs(config.distanceX) > 10 || Math.abs(config.distanceY) > 10) {
          config.isTouchMoved = true;
          self.gameCustom.gamePlaneTranslateX = config.distanceX + config.xOffset;
          self.gameCustom.gamePlaneTranslateY = config.distanceY + config.yOffset;
        }
      }
    },
    touchEnd(event) {
      if (!config.isTouchMoved) {
        // handle tap event on the movable element
        // event.preventDefault();
      } else {
      }
    },
  });

  document.body.addEventListener('mousedown', events.mouseDown);
  document.body.addEventListener('mouseup', events.mouseUp);
  document.body.addEventListener('mousemove', events.mouseMove);
  document.body.addEventListener('touchstart', events.touchStart);
  document.body.addEventListener('touchmove', events.touchMove);
  document.body.addEventListener('touchend', events.touchEnd);
}

function removeMouseEvents() {
  document.body.removeEventListener('mousedown', events.mouseDown);
  document.body.removeEventListener('mouseup', events.mouseUp);
  document.body.removeEventListener('mousemove', events.mouseMove);
  document.body.removeEventListener('touchstart', events.touchStart);
  document.body.removeEventListener('touchmove', events.touchMove);
  document.body.removeEventListener('touchend', events.touchEnd);
}

function resetMouseEventsConfig({ xOffset = 0, yOffset = 0, rotation = 0 } = {}) {
  config.xOffset = xOffset;
  config.yOffset = yOffset;
  config.rotation = rotation;
}

export { addMouseEvents, removeMouseEvents, resetMouseEventsConfig, events, config };
