async function createFrameContaining1PxRectangles(paint) {
  // Only operate on images (but you could do it
  // for solid paints and gradients if you wanted)
  if (paint.type === 'IMAGE') {
    // Paints reference images by their hash.
    const image = figma.getImageByHash(paint.imageHash)

    // Get the bytes for this image. However, the "bytes" in this
    // context refers to the bytes of file stored in PNG format. It
    // needs to be decoded into RGBA so that we can easily operate
    // on it.
    const bytes = await image.getBytesAsync()

    // Decoding to RGBA requires browser APIs that are only available
    // within an iframe. So we create an invisible iframe to act as
    // a "worker" which will do the task of decoding and send us a
    // message when it's done. This worker lives in `decoder.html`
    figma.showUI(__html__, { visible: false })

    // Send the raw bytes of the file to the worker
    figma.ui.postMessage(bytes)

    // Wait for the worker's response
    const newBytes: {colors: RGBA[], width: number} = await new Promise((resolve, reject) => {
      figma.ui.onmessage = value => resolve(value as {colors: RGBA[], width: number})
    })

    const frame = figma.createFrame()
    frame.backgrounds = []
    frame.resizeWithoutConstraints(newBytes.width, newBytes.colors.length / newBytes.width)
    newBytes.colors.forEach((color: RGBA, i: number) => {
      const pixel = figma.createRectangle()
      pixel.fills = [{ type: 'SOLID', color: {r: color.r, g: color.g, b: color.b}, opacity: color.a }]
      pixel.x = i % newBytes.width
      pixel.y = Math.floor(i / newBytes.width)
      pixel.name = `${rgbToHex(color.r, color.g, color.b)}${displayOpacity(color.a)}`
      pixel.resizeWithoutConstraints(1, 1)
      frame.appendChild(pixel)
    })

    return frame
  }
  return null
}

function displayOpacity(opacity: number) {
  return opacity === 1 ?
    "" :
    ` ${Math.floor(opacity * 100) / 100}%`
}

function componentToHex(c: number) {
  var hex = (c * 255).toString(16).toUpperCase();
  return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

async function generateIfApplicable(node) {
  // Look for fills on node types that have fills.
  // An alternative would be to do `if ('fills' in node) { ... }
  switch (node.type) {
    case 'RECTANGLE':
    case 'ELLIPSE':
    case 'POLYGON':
    case 'STAR':
    case 'VECTOR':
    case 'TEXT': {
      // Create a new array of fills, because we can't directly modify the old one
      for (const paint of node.fills) {
        const frame = await createFrameContaining1PxRectangles(paint)
        if (frame) {
          frame.x = node.x + node.width + 1
          frame.y = node.y
          frame.name = `${node.name} 1px rectangles`
          figma.currentPage.appendChild(frame)
        }
      }
      break
    }

    default: {
      // not supported, silently do nothing
    }
  }
}

// This plugin looks at all the currently selected nodes and inverts the colors
// in their image, if they use an image paint.
Promise.all(figma.currentPage.selection.map(selected => generateIfApplicable(selected)))
       .then(() => figma.closePlugin())
