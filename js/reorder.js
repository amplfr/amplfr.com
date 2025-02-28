// based on https://htmldom.dev/drag-and-drop-element-in-a-list/
let draggingEle;
let placeholder;
let isDraggingStarted = false;

// The current position of mouse relative to the dragging element
let x = 0;
let y = 0;

// Check if `nodeA` is above `nodeB`
const isAbove = function (nodeA, nodeB) {
  // Get the bounding rectangle of nodes
  const rectA = nodeA.getBoundingClientRect();
  const rectB = nodeB.getBoundingClientRect();

  return rectA.top + rectA.height / 2 < rectB.top + rectB.height / 2;
};
// Swap two nodes
const swap = function (nodeA, nodeB) {
  const parentA = nodeA.parentNode;
  const siblingA = nodeA.nextSibling === nodeB ? nodeA : nodeA.nextSibling;

  // Move `nodeA` to before the `nodeB`
  nodeB.parentNode.insertBefore(nodeA, nodeB);

  // Move `nodeB` to before the sibling of `nodeA`
  parentA.insertBefore(nodeB, siblingA);
};

export const reorderStart = function (e) {
  e.stopPropagation(); // don't also bubble up to the parent
  console.log(`reorderStart`);
  draggingEle = e.currentTarget;

  // Calculate the mouse position
  const rect = draggingEle.getBoundingClientRect();
  //   x = e.pageX - rect.left;
  //   y = e.pageY - rect.top;
  y = e.pageY;

  // Attach the listeners to `document`
  document.addEventListener("mousemove", reorderMove);
  document.addEventListener("mouseup", reorderFinish);
};

const reorderMove = function (e) {
  e.stopPropagation(); // don't also bubble up to the parent
  const draggingRect = draggingEle.getBoundingClientRect();

  if (!isDraggingStarted) {
    isDraggingStarted = true;

    // Let the placeholder take the height of dragging element
    // So the next element won't move up
    placeholder = document.createElement("li");
    placeholder.classList.add("placeholder");
    draggingEle.parentNode.insertBefore(placeholder, draggingEle.nextSibling);
    placeholder.style.height = `${draggingRect.height}px`;
  }

  // Set position for dragging element
  draggingEle.style.position = "absolute";
  draggingEle.style.top = `${e.pageY - y}px`;
  draggingEle.style.zindex = 1000;
  //   draggingEle.style.left = `${e.pageX - x}px`;

  //   console.log(
  //     `pageX: ${e.pageX} pageY: ${e.pageY} ` +
  //       `x: ${x} y: ${y} ` +
  //       `top: ${draggingEle.style.top} left: ${draggingEle.style.left}`
  //   );
  //   console.log(`pageY: ${e.pageY} y: ${y} top: ${draggingEle.style.top}`);

  // The current order
  // prevEle
  // draggingEle
  // placeholder
  // nextEle
  const prevEle = draggingEle.previousElementSibling;
  const nextEle = placeholder.nextElementSibling;

  // The dragging element is above the previous element
  // User moves the dragging element to the top
  if (prevEle && isAbove(draggingEle, prevEle)) {
    // The current order    -> The new order
    // prevEle              -> placeholder
    // draggingEle          -> draggingEle
    // placeholder          -> prevEle
    swap(placeholder, draggingEle);
    swap(placeholder, prevEle);
    return;
  }

  // The dragging element is below the next element
  // User moves the dragging element to the bottom
  if (nextEle && isAbove(nextEle, draggingEle)) {
    // The current order    -> The new order
    // draggingEle          -> nextEle
    // placeholder          -> placeholder
    // nextEle              -> draggingEle
    swap(nextEle, placeholder);
    swap(nextEle, draggingEle);
  }
};

const reorderFinish = function (e) {
  e.stopPropagation(); // don't also bubble up to the parent
  // Remove the placeholder
  placeholder && placeholder?.parentNode.removeChild(placeholder);

  draggingEle.style.removeProperty("top");
  //   draggingEle.style.removeProperty("left");
  draggingEle.style.removeProperty("position");
  draggingEle.style.removeProperty("z-index");

  x = null;
  y = null;
  draggingEle = null;
  isDraggingStarted = false;

  // Remove the handlers of `mousemove` and `mouseup`
  document.removeEventListener("mousemove", reorderMove);
  document.removeEventListener("mouseup", reorderFinish);
};
