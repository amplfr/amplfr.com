/**
 * Sets a class for the body object based on the current width.
 * The 3 widths (in pixels) of interest are:
 *  - 1200 or greater
 *  -  800
 *  -  600 or less
 */
const checkBodyWidth = () => {
    // const width = document.body.clientWidth;
    const width = document.body.scrollWidth;
    // document.body.classList.toggle("columns", width > 1200);
    document.body.classList.add("columns");

    // let isNarrow = width <= 800;
    // document.body.classList.toggle("poster", isNarrow);

    isNarrow = width <= 600;
    document.body.classList.toggle("narrow", isNarrow);
    document.body.classList.toggle("poster", document.body.scrollHeight <= 600 || isNarrow);
};
/**
 * Toggles visibility of Queue element. 
 * Single click/tap toggles between visible or not by toggle()'ing the "active" class for the body element.
 * More than single clicking toggles Queue between column or row orientation.
 *  TODO - multi-tapping doesn't currently work.
 * @param {null|boolean|MouseEvent|PointerEvent} e 
 *  Null - just toggles visibility
 *  boolean - force visibility to "is visible" (true) or not (false) regardless of current state.
 *  PointerEvent - detect one or more taps, and process accordingly
 *  MouseEvent - detect one or more clicks, and process accordingly
 */
const toggleQueue = (e = null) => {
    let isActive;
    if (
        e?.constructor.name === "PointerEvent" ||
        e?.constructor.name === "MouseEvent"
    ) {
        e.preventDefault();
        if (e.detail > 1) document.body.classList.toggle("columns");
        // e.currentTarget.classList.toggle("active", !isActive);
        // e = null;
    }

    if (typeof e === "boolean")
        isActive = document.body.classList.toggle("queueClosed", e);
    else isActive = !document.body.classList.toggle("queueClosed");

    if (!!e.currentTarget?.classList)
        e.currentTarget.classList.toggle("active", !isActive);
};

/**
 * Toggles visibility of Search input element. 
 * Single click/tap toggles between visible or not by toggle()'ing the "active" class for the body element.
 * @param {*} eTarget 
 * @param {null|boolean|MouseEvent|PointerEvent} e 
 */
const toggleSearch = (eTarget, e = null) => {
    let isActive;
    if (
        e?.constructor.name === "PointerEvent" ||
        e?.constructor.name === "MouseEvent"
    ) {
        e.preventDefault();
        isActive = e.currentTarget.classList.toggle("active");
    }

    if (typeof e === "boolean")
        isActive = eTarget.classList.toggle("active", e);
    else isActive = eTarget.classList.toggle("active");
    if (isActive) eTarget.focus({ focusVisible: false });
};

/**
 * 
 * @param {*} e 
 */
const scrollHorizontal = (e) => {
    const div = e.currentTarget,
        left = div.scrollLeft,
        y = e.deltaY;
    if (
        (y > 0 && left + div.clientWidth < div.scrollWidth) ||
        (y < 0 && left > 0)
    ) {
        e.preventDefault();
        div.scrollLeft += y;
    }
};

/**
 * 
 * @param {String} tagName String of what element to create.
 * @param {Object} values Object
 * @returns HTMLElement
 */
const createElement = (tagName, values) => {
    let newElement = document.createElement(tagName);
    if (!values) return newElement

    if (!!values.innerText) newElement.innerText = values.innerText;

    if (!!values.classes) {
        if (!Array.isArray(values.classes)) {
            // treat it as a String if it has a length and then make an Array of size 1
            if (values.classes?.length) values.classes = [values.classes];
            else
                Object.entries(values.classes).forEach(([k, v]) => {
                    newElement.classList.toggle(k, v || true);
                });
        }
        // re-check if it is an Array again in case we converted
        if (Array.isArray(values.classes)) {
            values.classes.forEach((k) => {
                newElement.classList.add(k);
            });
        }
    }

    if (!!values.attributes)
        Object.entries(values.attributes).forEach(([k, v]) => {
            newElement.setAttribute(k, v);
        });

    return newElement;
};
