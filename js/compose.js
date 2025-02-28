/**
 * Composes each source class (and its public methods) onto target.
 * @link Object.assign
 * @param {Object} target   Has each of the composed source classs (and their respective methods) composed onto it.
 * @param {Object} source   Each class to be composed onto target. All of source's public methods are composed onto target, such that target.method() { return target._source.method() }
 * @param {string} [key]    The key that references source once it has been composed onto target (e.g., target.key = source). Default is to use source's class/object name.
 * @param {string[]} [skip] Array of method, field names to skip composing onto target from source. Default is all non-private methods, fields.
 */
// const compose = (target, source, key = null, skip = []) => {
const compose = (target, source, options = {
    key: null,
    skip: [],
    composeFrom: null,
}) => {
    // use specified key or source's class name
    // key = key || source?.prototype?.constructor?.name || source?.constructor.name
    let key = options.key || source?.prototype?.constructor?.name || source?.constructor.name
    key = `#${key}`       // don't want name accessible from outside of target
    target[key] = source

    let skip = [...options.skip]

    let composeFrom = options.composeFrom
    if (!composeFrom) {
        composeFrom = source
        // source is a non-instatiated class
        if (!!source?.prototype?.constructor?.name) {
            composeFrom = source.prototype

            // can't instantiate source class with New keyword because source could be any class
            //  [from https://stackoverflow.com/a/31195117]
            target[key] = Object.create(source.prototype);
        }
        // source is an instatiated class
        else if (!!source?.constructor?.name && source.constructor.name !== "Object")
            composeFrom = source.constructor.prototype
    }

    // minimum methods/fields to not compose from source onto target
    skip.push('constructor')
    skip.push('addEventListener')

    // compose all of source's public methods - including get()ers and set()ers - onto target
    // same as manually writing:
    //      target.sourceMethod() { return target[_key].sourceMethod() }
    const descriptors = Object.getOwnPropertyDescriptors(composeFrom)
    for (const [k, descriptor] of Object.entries(descriptors)) {
        if (!skip.includes(k) && !!!target[key][k]) {
            let functions = {}
            if (descriptor?.get)
                Object.assign(functions, { get() { return target[key][k] } })
            if (descriptor?.set)
                Object.assign(functions, { set(v) { target[key][k] = v } })
            if (typeof descriptor?.value == "function")
                target[k] = (x) => { target[key][k](x) }

            if (Object.keys(functions).length > 0)
                // Object.defineProperty(target, key, functions)
                Object.defineProperty(target, k, functions)
        }
    }

    return target
}


//     alpha: true,
// }
// let bar = {
//     bravo: 1,
//     charlie: false,
//     _src: "//localhost/"
// }
// console.info(foo)
// console.info(bar)
// // let baz = compose(foo, { "media": bar })
// let baz = compose(foo, bar, "bar")
// console.info(baz)
// foo = compose(foo, bar)

// class Fizz {
//     // msg = "hello world"
//     #msg

//     constructor(msg) {
//         console.info(`called ${this.constructor.name}'s constructor("${msg}")`)
//         this.#msg = msg
//     }
//     hello() {
//         console.info("hello world")
//         // console.info(this.msg)
//     }
//     get msg() {
//         return this.#msg;
//     }
// }

// let fizz = new Fizz("look at all those chickens")

// // bar = compose(bar, Fizz)
// bar = compose(bar, new Fizz("i love Chipotle"), "fizz")
// console.info(bar)
// console.info(bar.msg)


/**
 * 
 * @param target Object         The class/object to remove the methods/objects from.
 * @param remove (String[]|Object[])  The individual methods (when a String) or object and its methods (when an Object) to remove from target.
 */
// const uncompose = (target, ...remove) => {
const uncompose = (...remove) => {
    const target = this

    remove.forEach(x => {
        // if x is a method name that isn't private (e.g., "#privateData")
        if (typeof x == "string" && !x.startsWith("#"))
            removeMethod(target, x)
        else if (typeof x == "object") {

        }
    })

    const removeMethod = (target, method) => {
        if (!!target[method] && typeof target[method] == "function")
            delete target[method]
    }
}


// const classTree = []
// const getSuperclass = (className, stopWhenMatches = "Object") => {
//     let superclass = Object.getPrototypeOf(className)

//     if (superclass.constructor.name != stopWhenMatches)
//         // return [superclass, getSuperclass(superclass)]
//         return getSuperclass(superclass)

//     classTree.push(superclass.constructor.name)

//     return superclass
// }

// getSuperclass(new Audio, "HTMLElement")
// console.info(classTree)

const ancestorClass = (object, maxGenerations)