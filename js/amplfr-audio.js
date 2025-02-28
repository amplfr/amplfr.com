class AmplfrAudio extends Audio {
    #loopCounter
    #listening

    constructor(src) {
        super() // call super() beccause you have to, but don't pass src to start downloading
        this.className = 'AmplfrAudio'
    }

    /**
     * Plays the media.
     */
    play() {
        // pause if not already
        if (!this.paused) {
            this.pause();
            return;
        }
        if (!!this.ended) this.fastSeek(0); // restart from the beginning if ended

        // stop any others that are already playing
        // "There can only be one"
        document.querySelectorAll('amplfr-item').forEach(item => {
            // console.this.#log(`${item.title} - is ${item.playing ? "" : "NOT"} playing`)
            if (item.playing) item.stop()
            item.classList.remove("active")
        })
        this.classList.add("active")

        // play (so long as there are no errors)
        if (!super.error) super.play();
    }
    /**
     * Pauses the media.
     */
    // prettier-ignore
    pause() { super.pause() }
    /**
     * Stops the media.
     * Equivilent to {@link AmplfrItem#pause|pause()} and {@link AmplfrItem#seekTo|seekTo(0)}
     */
    stop() {
        this.pause();
        this.fastSeek(this?.startTime || 0); // reset the time back to beginning
    }
    /**
     * Fast seeks to the specified time.
     * @param {number} s The time to seek to in seconds (float or integer).
     * @see {@link seekTo}
     */
    // prettier-ignore
    fastSeek(s) { this.seekTo(s, false) }
    /**
     * Seeks to the specified time.
     * @param {number} s The time to seek to in seconds (float or integer).
     * If less than 0, will seek to start time or 0. If greater than the duration, will seek to end time or (duration).
     * @param {boolean} [precise=FALSE] If true uses the more precise currentTime, otherwise use fastSeek
     */
    seekTo(s, precise = false) {
        // if (!this) return;
        // let startTime = this._data.start || 0;
        // let endTime = this._data.end || this.duration || 0;
        // s = Math.max(startTime, Math.min(s, endTime)); // keep s within known range

        if (!precise && super.fastSeek)
            super.fastSeek(s); // faster (??)
        else super.currentTime = s; // more precise
    }

    // media property get'ers - each returns null if this is null
    // get startTime() {
    // try to extract start and end times if url is actually a URL
    // let startTime = this.#data.startTime;
    // let searchParams = {};
    // if (!startTime) {
    //     try {
    //         searchParams = this.sourceURL.searchParams;
    //     } catch (error) { }

    //     startTime = searchParams["s"] || !!searchParams["start"] || 0;
    //     this.#data.startTime = startTime;
    // }
    // return startTime;
    // }
    // get endTime() {
    // try to extract start and end times if url is actually a URL
    // let endTime = this.#data.endTime;
    // let searchParams = {};
    // if (!endTime) {
    //     try {
    //         searchParams = this.sourceURL.searchParams;
    //     } catch (error) { }

    //     endTime = searchParams["e"] || !!searchParams["end"] || this.duration;
    //     this.#data.endTime = endTime;
    // }
    // return endTime;
    // }
    // prettier-ignore
    // get loaded() { return this?.loaded || 0.0 }
    // prettier-ignore
    get buffered() { return super.buffered }
    // prettier-ignore
    get currentTime() { return super.currentTime }
    // prettier-ignore
    get duration() { return super.duration }
    // prettier-ignore
    get durationMMSS() { return (!!this.duration) ? Number(this.duration).toMMSS() : null }
    // prettier-ignore
    get ended() { return super.ended }
    // prettier-ignore
    get error() { return super.error }
    // prettier-ignore
    get loop() { return (!!this.#loopCounter && this.#loopCounter > 0) || super.loop }
    // prettier-ignore
    get muted() { return super.muted }
    // prettier-ignore
    get networkState() { return super.networkState }
    // prettier-ignore
    get paused() { return super.paused }
    get playing() {
        // ==false means its playing, but null means nothing
        return this.paused === false ? true : false;
    }
    // // prettier-ignore
    get playbackRate() { return super.playbackRate }
    // // prettier-ignore
    get readyState() { return super.readyState }
    // // prettier-ignore
    get seekable() { return super.seekable }
    // // prettier-ignore
    get volume() { return super.volume }

    // media property set'ers
    /**
     * Seeks to the specified time.
     * @param {number} v The time to seek to in seconds (float or integer).
     * @see {@link seekTo}
     */
    // prettier-ignore
    set currentTime(v) { this.seekTo(v, true); }
    /**
     * Fast seeks to the specified time.
     * @param {number|boolean} [v=!loop] The number of times to loop through all of the items, true to loop indefinitely, or false to not loop again.
     */
    // set loopAll(v = !this.loopAll) {
    set loop(v = !this.loop) {
        // if (!this) return;
        super.loop = !!v;
        if (typeof v == "number") {
            this.#loopCounter = Math.max(1, v); // save the number of times to loop (>=0)

            this.addEventListener("seeked", (e) => { this.#decrementLoops() });

            if (v <= 0) this.#decrementLoops();
        }
    }
    #decrementLoops() {
        --this.#loopCounter; // one less time to loop

        // no more looping
        if (this.#loopCounter <= 0) {
            this.#loopCounter = 0;
            super.loop = false;
            this.removeEventListener("seeked", (e) => { this.#decrementLoops() });
        }
    };
    // prettier-ignore
    set muted(v = !super.muted) { super.muted = (!!v) }
    // prettier-ignore
    set playbackRate(v = 1) { super.playbackRate = v }
    // prettier-ignore
    set volume(v = 1) { this.volume = v }


    addEventListener(type, listener, options) {
        const mediaListeners = [
            "abort",
            "canplay",
            "canplaythrough",
            "durationchange",
            "emptied",
            "ended",
            "error",
            "loaded",   // added
            "loadeddata",
            "loadedmetadata",
            "loadstart",
            "pause",
            "play",
            "playing",
            "progress",
            "ratechange",
            "resize",
            "seeked",
            "seeking",
            "stalled",
            "suspend",
            "timeupdate",
            "volumechange",
            "waiting",
        ];
        this.#listening = this.#listening || []
        const t = `${type},${listener.toString()},${options}`

        if (mediaListeners.includes(type) && !this.#listening.includes(t)) {
            this.#listening.push(t)  // remember to avoid overflow of repeats

            this.addEventListener(type, listener, options);
        }
        // anything not known, send it onwards to the parent class
        else super.addEventListener(type, listener, options)
    }
}
customElements.define("amplfr-audio", AmplfrAudio, { extends: "audio" });
