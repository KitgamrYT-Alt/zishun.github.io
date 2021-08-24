// @todo: 
// addNumberBox: step, min, max. width.
// multiple round operation: clear, reset, etc.
// suggested edge length

"use strict"

import * as THREE from './js/three.module.js';
import { TrackballControls } from './js/TrackballControls.js';
import { OBJExporter } from './js/OBJExporter.js';
import './js/yagui.js';

let CONTAINER;
let CAMERA, CONTROLS, SCENE, RENDERER;
let MESH_IN, MESH_OUT;
let DIHEDRAL_ANGLE = 20, EDGE_ANGLE = 20;
let TARGET_EDGE_LENGTH = 1.0;
let NUM_ITERS = 10;


const HEAP_MAP = {
    HEAP8: Int8Array, // int8_t
    HEAPU8: Uint8Array, // uint8_t
    HEAP16: Int16Array, // int16_t
    HEAPU16: Uint16Array, // uint16_t
    HEAP32: Int32Array, // int32_t
    HEAPU32: Uint32Array, // uint32_t
    HEAPF32: Float32Array, // float
    HEAPF64: Float64Array // double
}

//window.addEventListener("wasmLoaded", () => {
initGUI();
init();
animate();
//})

function initGUI() {
    CONTAINER = document.getElementById( 'viewport' );

    let main = new window.yagui.GuiMain(viewport, onWindowResize); // main gui

    let rightbar = main.addRightSidebar(onWindowResize); // right bar
    let menuright = rightbar.addMenu('Mesh Viewer');
    menuright.addTitle('IO');
    menuright.addDualButton('Load', 'Save', loadFile, save);
    
    menuright.addCheckbox('Input Mesh', true, toggleInputMesh);
    menuright.addCheckbox('Output Mesh', true, toggleOutputMesh);

    menuright.addTitle('Feature Detection');
    menuright.addSlider('Dihedral angle', DIHEDRAL_ANGLE, setDihedralAngle, 0, 180, 1);
    menuright.addSlider('Edge angle', EDGE_ANGLE, setEdgeAngle, 0, 180, 1);
    menuright.addButton('Update features', update_features);

    menuright.addTitle('Remeshing');
    menuright.addNumberBox('Edge length', TARGET_EDGE_LENGTH, setEdgeLength);
    menuright.addNumberBox('Iterations', NUM_ITERS, setNumIters);
    menuright.addButton('Remesh', remesh);

}

function init() {

    CONTAINER = document.getElementById( 'viewport' );

    //CAMERA = new THREE.PerspectiveCamera( 20, window.innerWidth / window.innerHeight, 1, 10000 );
    CAMERA = new THREE.PerspectiveCamera( 20, CONTAINER.offsetWidth / CONTAINER.offsetHeight, 1, 10000);

    SCENE = new THREE.Scene();
    SCENE.background = new THREE.Color( 0xffffff );

    // @todo: set them as camera's children
    const light0 = new THREE.DirectionalLight( 0xa0a0a0 );
    light0.position.set( 1, 1, 0 );
    SCENE.add( light0 );
    light0.parent = CAMERA;

    RENDERER = new THREE.WebGLRenderer( { antialias: true } );
    RENDERER.setPixelRatio( window.devicePixelRatio );
    //RENDERER.setSize( window.innerWidth, window.innerHeight );
    RENDERER.setSize(CONTAINER.offsetWidth, CONTAINER.offsetHeight);
    CONTAINER.appendChild( RENDERER.domElement );

    CONTROLS = new TrackballControls(CAMERA, RENDERER.domElement);

    window.addEventListener( 'resize', onWindowResize );

}

function loadFile() {
    let input = document.createElement('input');
    input.id = "meshfile";
    input.type = 'file';
    input.accept = '.obj';
    input.click();
    let output = document.getElementById('output');
    output.hidden= true;
    input.addEventListener('change', readData, false);
    function readData() {
        var data = new FileReader();
        data.onload = function(){
            output.textContent = this.result;
            loadOBJTriMesh();
        };
        data.readAsText(this.files[0]);
    }
}

function loadOBJTriMesh() {
    // load trimesh from a obj file.
    let text = document.getElementById('output').textContent;
    // console.log(text);

    let vertices = [];
    let findices = [];

    // https://github.com/mrdoob/three.js/blob/44b8fa7b452dd0d291b9b930fdfc5721cb6ebee9/examples/jsm/loaders/OBJLoader.js
    if ( text.indexOf( '\r\n' ) !== - 1 ) {
        // This is faster than String.split with regex that splits on both
        text = text.replace( /\r\n/g, '\n' );
    }

    if ( text.indexOf( '\\\n' ) !== - 1 ) {
        // join lines separated by a line continuation character (\)
        text = text.replace( /\\\n/g, '' );
    }

    const lines = text.split( '\n' );
    let line = '', lineFirstChar = '';
    let lineLength = 0;

    // Faster to just trim left side of the line. Use if available.
    const trimLeft = ( typeof ''.trimLeft === 'function' );

    for ( let i = 0, l = lines.length; i < l; i ++ ) {
        line = lines[ i ];
        line = trimLeft ? line.trimLeft() : line.trim();
        lineLength = line.length;
        if ( lineLength === 0 ) continue;

        lineFirstChar = line.charAt( 0 );

        // @todo invoke passed in handler if any
        if ( lineFirstChar === '#' ) continue;

        if ( lineFirstChar === 'v' ) {

            const data = line.split( /\s+/ );

            switch ( data[ 0 ] ) {
                case 'v':
                    vertices.push(
                        parseFloat( data[ 1 ] ),
                        parseFloat( data[ 2 ] ),
                        parseFloat( data[ 3 ] )
                    );
                    break;
                // case 'vn':
                // case 'vt':
            }

        } else if ( lineFirstChar === 'f' ) {

            const lineData = line.substr( 1 ).trim();
            const vertexData = lineData.split( /\s+/ );
            const f = [];

            for (let j = 0; j < vertexData.length; j++) {
                const vertex = vertexData[ j ];

                if ( vertex.length > 0 ) {
                    const vertexParts = vertex.split( '/' );
                    f.push(parseInt(vertexParts[0])-1);
                    //findices.push( parseInt(vertexParts[0])-1 );
                } else {
                    console.warn( 'THREE.OBJLoader: Unexpected line: "' + line + '"' );
                }
            }
            for (let j = 1; j < f.length-1; j++) {
                findices.push( f[0], f[j], f[j+1] );
            }

        } else {

            // Handle null terminated files without exception
            if ( line === '\0' ) continue;

            // console.warn( 'THREE.OBJLoader: Unexpected line: "' + line + '"' );

        }

    }

    // init mesh
    SCENE.remove(MESH_IN);

    var geom = new THREE.BufferGeometry();
    geom.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    geom.setIndex( findices );

    const material = new THREE.MeshPhongMaterial( {
        color: 0xffffff,
        flatShading: true,
        vertexColors: false,
        shininess: 0,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1, // positive value pushes polygon further away
        polygonOffsetUnits: 1
    } );
    const wireframeMaterial = new THREE.MeshBasicMaterial( { color: 0x000000, wireframe: true, transparent: true } );
   
    MESH_IN = new THREE.Mesh(geom, material);
    let wireframe = new THREE.Mesh( geom, wireframeMaterial );
    MESH_IN.add(wireframe);
    MESH_IN.geometry.computeVertexNormals();
    SCENE.add(MESH_IN);

    // reset camera
    geom.computeBoundingSphere();
    const c = geom.boundingSphere.center;
    const r = geom.boundingSphere.radius;
    CONTROLS.target = c;
    CAMERA.position.set(c.x, c.y, c.z+r*8);
    CAMERA.lookAt(c);
    CAMERA.updateProjectionMatrix();

    Module.ccall("create_remesher", null, [], []);
    ccallArrays("set_mesh", null, null, null, ["array", "array"], [vertices, findices], ["HEAPF64", "HEAP32"]);
}

function onWindowResize() {

    // windowHalfX = window.innerWidth / 2;
    // windowHalfY = window.innerHeight / 2;

    //CAMERA.aspect = window.innerWidth / window.innerHeight;
    CAMERA.aspect = CONTAINER.offsetWidth / CONTAINER.offsetHeight;
    CAMERA.updateProjectionMatrix();

    //RENDERER.setSize( window.innerWidth, window.innerHeight );
    RENDERER.setSize( CONTAINER.offsetWidth, CONTAINER.offsetHeight );

}

function animate() {

    requestAnimationFrame( animate );

    CONTROLS.update();
    render();

}

function render() {

    RENDERER.render( SCENE, CAMERA );

}

function save() {
    var comments = '# Remeshed\n';
    
    var exporter = new OBJExporter();
    var result = comments + exporter.parse( MESH_OUT );
    var MIME_TYPE = 'text/plain';

    var bb = new Blob([result], {type: MIME_TYPE});

    var a = document.createElement('a');
    a.download = 'remesh.obj';
    a.href = window.URL.createObjectURL(bb);
    a.textContent = 'Download ready';
    a.dataset.downloadurl = [MIME_TYPE, a.download, a.href].join(':');
    a.click();
}

function setDihedralAngle(angle) {
    DIHEDRAL_ANGLE = angle; 
}

function setEdgeAngle(angle) {
    EDGE_ANGLE = angle;
}

function update_features() {
    Module.ccall("set_features_by_dihedral_angle", null, ["number"], [DIHEDRAL_ANGLE]);
    Module.ccall("set_feature_vertices_by_angle", null, ["number"], [EDGE_ANGLE]);
    // Module.ccall("collect_features", null, [], []);
}

function setEdgeLength(l) {
    TARGET_EDGE_LENGTH = l;
}

function setNumIters(n) {
    NUM_ITERS = n;
}

function remesh() {
    Module.ccall("collect_features", null, [], []);

    Module.ccall("remesh", null, ["number", "number"], [TARGET_EDGE_LENGTH, NUM_ITERS]);
    let numV = Module.ccall("get_mesh_num_v", null, [], []);
    let numF = Module.ccall("get_mesh_num_f", null, [], []);
    let verts = Module.ccall("get_mesh_v", null, [], []);
    let faces = Module.ccall("get_mesh_f", null, [], []);

    const vertices = []
    const findices = []

    for (let i=0; i<numV*3; i++) {
        vertices.push(Module["HEAPF64"][verts/HEAP_MAP["HEAPF64"].BYTES_PER_ELEMENT+i])
    }
    for (let i=0; i<numF*3; i++) {
        findices.push(Module["HEAP32"][faces/HEAP_MAP["HEAP32"].BYTES_PER_ELEMENT+i])
    }

    SCENE.remove(MESH_OUT);

    var geom = new THREE.BufferGeometry();
    geom.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    geom.setIndex( findices );

    const material = new THREE.MeshPhongMaterial( {
        color: 0xffffff,
        flatShading: true,
        vertexColors: false,
        shininess: 0,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1, // positive value pushes polygon further away
        polygonOffsetUnits: 1
    } );
    const wireframeMaterial = new THREE.MeshBasicMaterial( { color: 0x000000, wireframe: true, transparent: true } );

    MESH_OUT = new THREE.Mesh(geom, material);
    let wireframe = new THREE.Mesh( geom, wireframeMaterial );
    MESH_OUT.add(wireframe);
    MESH_OUT.geometry.computeVertexNormals();
    SCENE.add(MESH_OUT);

}

// from https://github.com/DanRuta/wasm-arrays/blob/master/dev/wasm-arrays.js
const ccallArrays = (func, 
    returnType, returnArrayType, returnArraySize,
    paramTypes, params, paramArrayTypes) => {

    // const heapMap = {}
    // heapMap.HEAP8 = Int8Array // int8_t
    // heapMap.HEAPU8 = Uint8Array // uint8_t
    // heapMap.HEAP16 = Int16Array // int16_t
    // heapMap.HEAPU16 = Uint16Array // uint16_t
    // heapMap.HEAP32 = Int32Array // int32_t
    // heapMap.HEAPU32 = Uint32Array // uint32_t
    // heapMap.HEAPF32 = Float32Array // float
    // heapMap.HEAPF64 = Float64Array // double

    let res
    let error
    paramTypes = paramTypes || []
    const returnTypeParam = returnType=="array" ? "number" : returnType
    const parameters = []
    const parameterTypes = []
    const bufs = []

    try {
        if (params) {
            for (let p=0; p<params.length; p++) {
                let heapIn = paramArrayTypes[p];

                if (paramTypes[p] == "array" || Array.isArray(params[p])) {

                    const typedArray = new HEAP_MAP[heapIn](params[p])
                    const buf = Module._malloc(typedArray.length * typedArray.BYTES_PER_ELEMENT)

                    switch (heapIn) {
                        case "HEAP8": case "HEAPU8":
                            Module[heapIn].set(typedArray, buf)
                            break
                        case "HEAP16": case "HEAPU16":
                            Module[heapIn].set(typedArray, buf >> 1)
                            break
                        case "HEAP32": case "HEAPU32": case "HEAPF32":
                            Module[heapIn].set(typedArray, buf >> 2)
                            break
                        case "HEAPF64":
                            Module[heapIn].set(typedArray, buf >> 3)
                            break
                    }

                    bufs.push(buf)
                    parameters.push(buf)
                    parameters.push(params[p].length)
                    parameterTypes.push("number")
                    parameterTypes.push("number")

                } else {
                    parameters.push(params[p])
                    parameterTypes.push(paramTypes[p]==undefined ? "number" : paramTypes[p])
                }
            }
        }

        res = Module.ccall(func, returnTypeParam, parameterTypes, parameters)
    } catch (e) {
        error = e
    } finally {
        for (let b=0; b<bufs.length; b++) {
            Module._free(bufs[b])
        }
    }

    if (error) throw error

    if (returnType=="array") {
        const returnData = []

        for (let v=0; v<returnArraySize; v++) {
            returnData.push(Module[returnArrayType][res/HEAP_MAP[returnArrayType].BYTES_PER_ELEMENT+v])
        }

        return returnData
    } else {
        return res
    }
}

function toggleInputMesh(checked) {
    MESH_IN.visible = checked;
}

function toggleOutputMesh(checked) {
    MESH_OUT.visible = checked;
}