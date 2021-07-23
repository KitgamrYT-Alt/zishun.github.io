/**
 * @author mrdoob / http://mrdoob.com/
 * Modified by Zishun Liu
 */

THREE.OBJExporter = function () {};

THREE.OBJExporter.prototype = {

	constructor: THREE.OBJExporter,

	parse: function ( object ) {

		var output = '';

		var indexVertex = 0;
		var indexVertexUvs = 0;
		var indexNormals = 0;

		var vertex = new THREE.Vector3();
		var normal = new THREE.Vector3();
		var uv = new THREE.Vector2();

		var i, j, k, l, m, face = [];

		var parseMesh = function ( mesh ) {

			var nbVertex = 0;
			var nbNormals = 0;
			var nbVertexUvs = 0;

			var geometry = mesh.geometry;

			var normalMatrixWorld = new THREE.Matrix3();

			if ( geometry instanceof THREE.Geometry ) {

				// shortcuts
				var vertices = geometry.vertices;

				// name of the mesh object
				output += 'o ' + mesh.name + '\n';

				// vertices

				if ( vertices !== undefined ) {

					for ( i = 0, l = vertices.length; i < l; i ++, nbVertex ++ ) {

						vertex = vertices[ i ].clone();
						
						// transfrom the vertex to world space
						vertex.applyMatrix4( mesh.matrixWorld );

						// transform the vertex to export format
						output += 'v ' + vertex.x + ' ' + vertex.y + ' ' + vertex.z + '\n';

					}

				}

				// uvs

				//if ( uvs !== undefined ) {}

				// normals

				//if ( normals !== undefined ) {}

				// faces

                for ( i = 0, l = geometry.faces.length; i < l; i ++ ) {
                    
					var face = geometry.faces[i].clone()
					output += 'f ' + (face.a+1) + ' ' + (face.b+1) + ' ' + (face.c+1) + "\n";

				}

			} else {

				console.warn( 'THREE.OBJExporter.parseMesh(): geometry type unsupported', geometry );

			}

			// update index
			indexVertex += nbVertex;
			//indexVertexUvs += nbVertexUvs;
			//indexNormals += nbNormals;

		};

		var parseLine = function ( line ) {

            console.warn( 'THREE.OBJExporter.parseLine(): not implemented', geometry );

		};

		object.traverse( function ( child ) {

			if ( child instanceof THREE.Mesh ) {

				parseMesh( child );

			}

			if ( child instanceof THREE.Line ) {

				parseLine( child );

			}

		} );

		return output;

	}

};
