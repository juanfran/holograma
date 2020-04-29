async function capture() {
  if (!globalScene.imageCapture) {
    const mediaStream = document.querySelector('video').srcObject;
    globalScene.imageCapture = new ImageCapture(mediaStream.getVideoTracks()[0]);
  }

  const imageBitmap = await globalScene.imageCapture.grabFrame();
  const canvas = document.createElement('canvas');
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;
  canvas.getContext('2d').drawImage(imageBitmap, 0, 0);
  globalScene.textureOriginal = new THREE.Texture(canvas);
  globalScene.textureOriginal.needsUpdate = true;

  return globalScene.textureOriginal.image;
}

async function loadModel(){
  // Load the model
  globalScene.net = await bodyPix.load({
    architecture: 'MobileNetV1',
    outputStride: 16,
    multiplier: 0.75,
    quantBytes: 2,
    internalResolution: 'medium',
    segmentationThreshold: 0.7
  });
}

async function loadAndPredict(img) {
  const segmentation = await globalScene.net.segmentPerson(img);
  createTextureAndParticlesFromSegmentation(segmentation);
}

async function init() {
  await loadModel();

  const responseFragmentShader = await fetch('./fragmentshaderParticle');
  globalScene.fragmentShader = await responseFragmentShader.text();

  const responseVertexshaderParticle = await fetch('./vertexshaderParticle');
  globalScene.vertexshaderParticle = await responseVertexshaderParticle.text();

  globalScene.aframeScene = document.querySelector('a-scene');

  globalScene.renderer = globalScene.aframeScene.renderer;
  globalScene.camera = document.querySelector('a-camera');

  globalScene.aframeScene.addEventListener('click', async () =>{
    const img = await capture();

    loadAndPredict(img);
  });
}

document.querySelector('a-scene').addEventListener('loaded', init());
