/*
  MosaicViewer
  by DrSnuggles
*/

'use strict'

window.mosaicViewer = ( function (my) {
  const name = 'MosaicViewer',
  pF = [0.005, 0.01, 0.02, 0.03, 0.04, 0.05, 0.0625, 0.125, 0.25, 1],
  extensions = ['jpg', 'webp', 'png', 'jpeg', 'gif', 'bmp', 'svg'],
  states = ['pixel', 'blur'],
  debug = true

  let state, // which effect will be used is random
  allImages, // all thumbs
  actInd,
  image, // full
  view,
  canv,
  ctx,
  viewTime = 0,
  pixelFactor = 1,
  lastY = null, // also used as visible/hidden
  pFi = 0, // pFindex
  rAF

  //
  // init
  //
  addEventListener('load', () => {
    log('onload')

    //
    // inject style
    //
    let style = document.createElement('style')
    style.text = 'text/css'
    style.appendChild( document.createTextNode(`
      .mosaicViewer {
        position: absolute;
        top: 0;
        left: 0;
        background-color: #000;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        text-align: left;
        display: none;
        opacity: 0;
        transition: opacity 0.5s ease-in-out;
      }
      .mosaicCanv {
        position: relative;
        image-rendering: pixelated;
      }
      .fadeIn {
        opacity: 1 !important;
      }
    `) )
    document.head.appendChild(style)

    //
    // inject HTML
    //
    document.body.insertAdjacentHTML('beforeend', `<div class="mosaicViewer">
      <canvas class="mosaicCanv"></canvas>
    </div>`)
    view = document.getElementsByClassName('mosaicViewer')[0]
    canv = document.getElementsByClassName('mosaicCanv')[0]
    ctx = canv.getContext('2d')

    /*
    ctx.imageSmoothingEnabled = false
    ctx.mozImageSmoothingEnabled = false
    ctx.webkitImageSmoothingEnabled = false
    */


    //nextImage = randomInteger(0, gfxObj.length-1)
    // now array is shuffled
    //nextImage = 0
    //loadImage( nextImage )
    // later when loaded canv.classList.add('fadeIn')

    //
    // Events
    //
    onkeydown = (ev) => {
      if (lastY == null) return
      let handled = false
      switch (ev.key) {
        case 'Escape':
          hide()
          handled = true
          break
        case "ArrowUp":
          zoom(-1)
          handled = true
          break
        case "ArrowDown":
          zoom(1)
          handled = true
          break
        case "ArrowLeft":
          prev()
          handled = true
          break
        case "ArrowRight":
          next()
          handled = true
          break
        default:
      }
      if (handled) ev.preventDefault()
    }

    onresize = () => {
      setTimeout( () => {
        resizer()
      }, 50)
    }
    
    onwheel = (ev) => {
      if (lastY == null) return
      if (ev.deltaY > 0) {
        zoom(1)
      } else {
        zoom(-1)
      }
    }
    
    oncontextmenu = (ev) => {
      if (lastY == null) return
      hide()
      ev.preventDefault()
    }


  }) // addeventlistener load

  //
  // helpers
  //
  function log(...args) {
    if (debug) console.log(`[${name}: ${new Date().toISOString()}]`, ...args)
  }
  function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
  function checkIMGloaded(img, cb) {
    if (img.naturalHeight > 0) {
      // now we know it has finished loading
      if (cb) cb(img)
    } else {
      // not yet finished loading, check again in a moment (200ms)
      setTimeout(()=>{
        checkIMGloaded(img, cb)
      }, 200)
    }
  }
  function tryLoad(img, extCounter = 0) {
    log(`tryLoad`, img, actInd)
    // first try to load
    
    // given was the thumbnail and we have to check for different formats
    let src = img.src
    src = src.replace('_thumb','') // remove _thumb
    let thumbExt = src.substr(src.lastIndexOf('.')) // get Extension

    // use ext attribute if set, else try different extensions, one after each other to be nice to the server
    let tryExt = img.getAttribute('ext')
    if (!tryExt) {
      tryExt = extensions[extCounter++]
    }
    src = src.replace(thumbExt, '.'+tryExt)

    let tmp = new Image()
    tmp.onload = (ev) => {
      checkIMGloaded(ev.target, (img)=>{
        log('img fully loaded', img)
        image = img
        viewTime = new Date()*1
        state = states[randomInteger(0, states.length-1)]
        log('next state', state)
        canv.width = img.naturalWidth
        canv.height = img.naturalHeight

        pFi = 0
        pixelFactor = pF[pFi]
        canv.style.filter = `blur(0)`
        //
        // show
        //
        show()
        
        /*
        ctx.imageSmoothingEnabled = false
        canv.style.imageRendering = 'pixelated'
        img.style.imageRendering = 'pixelated'
        */

        // ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight)
        // now make pixelated image
        /*
        for (let x = 0; x < gfxObj[0].width; x+= step) {
          for (let y = 0; y < gfxObj[0].height; y+= step) {
            const pixel = gfxObj[0].ctx.getImageData(x, y, 1, 1).data
          }
        }
        */

      })
    }
    tmp.onerror = (ev) => {
      log('Could not load', src)
      if (!img.getAttribute('ext') && extCounter < extensions.length) tryLoad(img, extCounter)
    }

    tmp.src = src
  }
  
  function show() {
    log('show')
    view.style.display = 'block'
    view.style.opacity = 0
    view.classList.add('fadeIn')
    
    // for nice modal even when scrolled
    lastY = scrollY
    document.body.style.position = 'fixed'
    document.body.style.margin = 0

    if (!rAF) renderLoop()
    resizer()
  }
  function hide() {
    log('hide')
    view.classList.remove('fadeIn')
    setTimeout(()=>{
      view.style.display = 'none'
    }, 500)
    
    // for nice modal even when scrolled
    document.body.style.position = ''
    document.body.style.margin = ''
    scrollTo(0, lastY)
    lastY = null

    cancelAnimationFrame(rAF)
    rAF = null

  }
  function zoom(f) {
    pFi += f
    if (pFi < 0) pFi = 0
    if (pFi > pF.length-1) pFi = pF.length-1
    pixelFactor = pF[pFi]
    log(pF[pFi])
  }
  function next() {
    log('next')
    if (actInd == allImages.length-1) return
    actInd++
    tryLoad(allImages[actInd])
  }
  function prev() {
    log('prev')
    if (actInd == 0) return
    actInd--
    tryLoad(allImages[actInd])
  }
  function getIndexOfNodeBySrc(src) {
    // there is no indexOf for NodeList
    let ind = -1
    allImages.forEach((img,i) => {
      if (img.src == src){
        ind = i
      }
    })
    return ind
  }

  //
  // Resizer
  //
  function resizer() {
    log('resizer')
    const imgRatio = canv.width / canv.height
    const dispRatio = innerWidth / innerHeight

    if (imgRatio > dispRatio) {
      canv.style.width = '100vw'
      canv.style.height = 'auto'
      canv.style.left = '0px'
      canv.style.top = (innerHeight - innerWidth/imgRatio) / 2 +'px'
    } else {
      canv.style.height = '100vh'
      canv.style.width = 'auto'
      canv.style.left = (innerWidth - innerHeight*imgRatio) / 2 +'px'
      canv.style.top = '0px'
    }

  }

  //
  // Render loop
  //
  function renderLoop(){
    rAF = requestAnimationFrame(renderLoop)

    //
    // timer things
    //
    let delta = new Date()*1 - viewTime
    if (actInd < allImages.length-1 && delta > 5000) {
      next()
      viewTime += 5000
    }

    // use max resolution
    //canv.width = gfxObj[nextImage].width
    //canv.height = gfxObj[nextImage].height

    ctx.clearRect(0, 0, canv.width, canv.height)
    

    switch (state) {
      case 'blur':
        ctx.drawImage(image, 0, 0)

        //const t = Math.cos(new Date() / 300)
        let blur = 10/(delta/40)
        if (blur < 0.5) blur = 0
        
        canv.style.filter = `blur(${blur}px)`
        break
      case 'pixel':
        //
        // timer things
        //
        if (pixelFactor < 1 && delta > 125) {
          //zoom(+1)
          pixelFactor += 0.05
          if (pixelFactor > 0.3) pixelFactor = 1
          log('pixelFactor', pixelFactor)
          viewTime += 125
        }

        // draw every step pixel
        // 1..100
        //let v = pixelFactor,
        //size = v ? v * 0.01 : 1,
        let w = canv.width * pixelFactor,//pF[pFi],
        h = canv.height * pixelFactor//pF[pFi]

        ctx.imageSmoothingEnabled = false
        ctx.drawImage(image, 0, 0, w, h)

        ctx.drawImage(canv, 0, 0, w, h, 0, 0, canv.width, canv.height)

        break
      default:
    }

  } // renderloop

  //
  // public
  //
  my.init = (sel) => {
    
    allImages = document.querySelectorAll(sel)
    log('init', sel, allImages)
    allImages.forEach((img) => {
      img.addEventListener('load', ()=>{
        img.classList.add('fadeIn')
      })
      img.addEventListener('click', ()=>{
        actInd = getIndexOfNodeBySrc(img.src)
        tryLoad(img)
      })
    })
  }

  //
  // exit
  //
  return my
}({}))
