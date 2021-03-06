async function createGroupContaining1PxRectangles(node: SceneNode) {
  // Get the bytes for this image. However, the "bytes" in this
  // context refers to the bytes of file stored in PNG format. It
  // needs to be decoded into RGBA so that we can easily operate
  // on it.
  const bytes = await node.exportAsync()

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

  const pixels: RectangleNode[] = []
  newBytes.colors.forEach((color: RGBA, i: number) => {
    const pixel = figma.createRectangle()
    pixel.fills = [{ type: 'SOLID', color: {r: color.r, g: color.g, b: color.b}, opacity: color.a }]
    pixel.x = i % newBytes.width
    pixel.y = Math.floor(i / newBytes.width)
    pixel.name = `${rgbToHex(color.r, color.g, color.b)}${displayOpacity(color.a)}`
    pixel.resizeWithoutConstraints(1, 1)
    pixels.push(pixel)
  })

  return figma.group(pixels, figma.currentPage)
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

async function main(): Promise<string | undefined> {
  // Make sure the selection is a single piece of text before proceeding.
  if (figma.currentPage.selection.length !== 1) {
    return "Please select a single node when running this plugin"
  }

  const node = figma.currentPage.selection[0]
  const group = await createGroupContaining1PxRectangles(node)
  group.x = node.x
  group.y = node.y
  group.name = `${node.name} 1px rectangles`

  node.remove()
}

main().then((message: string | undefined) => {
  figma.closePlugin(message)
})
