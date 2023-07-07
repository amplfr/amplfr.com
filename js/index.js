/**
 * Sets a class for the body object based on the current width.
 * The 3 widths (in pixels) of interest are:
 *  - 1200 or greater
 *  -  800
 *  -  600 or less
 */
const checkBodyWidth = () => {
    const width = document.body.clientWidth;
    document.body.classList.toggle("columns", width > 1200);

    let isNarrow = width <= 800;
    document.body.classList.toggle("poster", isNarrow);

    isNarrow = width <= 600;
    document.body.classList.toggle("narrow", isNarrow);
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
        e.currentTarget.classList.toggle("active", !isActive);
        e = null;
    }

    if (typeof e === "boolean")
        isActive = document.body.classList.toggle("queueClosed", e);
    else isActive = !document.body.classList.toggle("queueClosed");
    // else document.body.classList.toggle("queueClosed");
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
