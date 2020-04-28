var net;
var scene = new THREE.Scene();
var renderer;
var time = 0;
var particles;
var camera;
var shaderMaterialParticles;
var textureOriginal = new THREE.Texture();
var textureDepthMap = new THREE.Texture();

function capture() {
  const canvas = document.getElementById('canvas');
  const video = document.querySelector('video');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

  textureOriginal = new THREE.Texture(canvas);
  textureOriginal.needsUpdate = true;

  loadAndPredict(textureOriginal.image);
}

async function loadModel(){
  // Load the model
  net = await bodyPix.load({
    architecture: 'MobileNetV1',
    outputStride: 16,
    multiplier: 0.75,
    quantBytes: 2,
    internalResolution: 'medium',
    segmentationThreshold: 0.7
  });
}

async function loadAndPredict(img) {
  const segmentation = await net.segmentPerson(img);
  createTextureAndParticlesFromSegmentation(segmentation);
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render() {
  time += 0.01;
  particles.material.uniforms.time.value = time ;
  renderer.render(scene, camera);
}

function createTextureAndParticlesFromSegmentation(seg) {
  if(particles) scene.remove(particles);

  var size = seg.width * seg.height;
  var data = new Uint8Array( 3 * size );
  subsamplingFactor = 4;
  var w = seg.width;
  var h = seg.height;
  var geometry = new THREE.BufferGeometry();
  var positions = [];
  var uvs = [];
  var u,v;
  var nbParticles = 0;
  var nAdded = 0;

  for ( var i = 0; i < size; i ++ ) {
    // Texture part
    var stride = i * 3;
    data[ stride ] = seg.data[i] * 255;
    data[ stride + 1 ] = seg.data[i];
    data[ stride + 2 ] = seg.data[i];

    // Particles part. We test if People or not to create a particle
    if(seg.data[i] > 0){
        if(nAdded % subsamplingFactor == 0){
            nbParticles++;
            u = (i % w ) / w;
            v = Math.floor(i / w) / h;
            positions.push(Math.random(), Math.random(), Math.random());
            uvs.push(u, 1. - v);  // flip y
        }
        nAdded++;
    }
  }

  // Part particles
  geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
  geometry.setAttribute( 'uvs', new THREE.Float32BufferAttribute( uvs, 2 ) );

  particles = new THREE.Points( geometry, shaderMaterialParticles );
  particles.material.uniforms.originalImage.value = textureOriginal;
  particles.position.z = -4;
  particles.frustumCulled = false;
  particles.material.uniforms.width.value = w ;
  particles.material.uniforms.height.value = h ;

  // Part texture
  textureSegmentation = new THREE.DataTexture( data, seg.width, seg.height, THREE.RGBFormat );
  textureSegmentation.flipY = true;
  time = 0;
  particles.material.uniforms.time.value = time ;
  particles.material.uniforms.depthMap.value = textureSegmentation;

  scene.add( particles );

  animate();
}

function init() {
  loadModel();

  document.querySelector('a-scene').addEventListener('loaded', async () => {
    const responseFragmentShader = await fetch('./fragmentshaderParticle');
    const fragmentShader = await responseFragmentShader.text();

    const responseVertexshaderParticle = await fetch('./vertexshaderParticle');
    const vertexshaderParticle = await responseVertexshaderParticle.text();

    renderer = document.querySelector('a-scene').renderer;
    camera = document.querySelector('#camera').components.camera.camera;

    const uniforms = {
      optionMode: {value: 1},
      userPos: {value: camera.position},
      width: {value: 1},
      height: {value: 1},
      time: {value: time},
      originalImage: { value: textureOriginal },
      depthMap: { value: textureDepthMap}
    };

    shaderMaterialParticles = new THREE.ShaderMaterial( {
      uniforms: uniforms,
      vertexShader: vertexshaderParticle,
      fragmentShader: fragmentShader,
      depthTest: false,
      transparent: true,
      vertexColors: true
    });

    document.body.addEventListener('click', () => {
      if (net) {
        capture();
      }
    });
  })
}

init();
