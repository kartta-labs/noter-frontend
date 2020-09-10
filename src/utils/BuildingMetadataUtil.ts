// Copyright 2020 Google LLC
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// version 2 as published by the Free Software Foundation.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

import uuidv1 from 'uuid/v1';
import {IPoint, IGeoPoint} from "../interfaces/IPoint";
import {FootprintPolygon, ImageData, LabelPolygon} from "../store/labels/types";
import {ISize} from "../interfaces/ISize";
import {EditorModel} from "../staticModels/EditorModel";
import {LabelsSelector} from "../store/selectors/LabelsSelector";
import {store} from "../index";
import {updateFootprint, updateActiveImageIndex, addImageData} from "../store/labels/actionCreators";
import axios from 'axios';
import {findLast} from "lodash";

const config = {
    headers: {'Content-Type': 'text/xml'},
    withCredentials: true
};

export class BuildingMetadataUtil {
    public static convertResponseToFootprint(response: any): FootprintPolygon[] {
        let footprint: FootprintPolygon[] = [];
        for (var i = 0; i < response.length; ++i) {
            let allVertices: IGeoPoint[] = [];
            for (var j = 0; j < response[i].length; ++j) {
                allVertices.push({x: response[i][j][0], y: response[i][j][1], isSelected: false, nodeId: null});
            }
            // check if last vertex is the same as the first, then remove it.
            if (allVertices[0].x === allVertices[allVertices.length - 1].x &&
                allVertices[0].y === allVertices[allVertices.length - 1].y) {
                allVertices.pop();
            }
            footprint.push({vertices: allVertices})
        }

        return BuildingMetadataUtil.normalizeFootprint(footprint);
    }

    public static normalizeFootprint(footprint: FootprintPolygon[]): FootprintPolygon[] {
        if(footprint && footprint.length > 0 && footprint[0].vertices.length > 0) {
            let minX = footprint[0].vertices[0].x;
            let maxX = footprint[0].vertices[0].x;
            let minY = footprint[0].vertices[0].y;
            let maxY = footprint[0].vertices[0].y;
            for (let i = 0; i < footprint.length; ++i) {
                for (let j = 0; j < footprint[i].vertices.length; ++j) {
                    let onePoint = footprint[i].vertices[j];
                    if (onePoint.x < minX) minX = onePoint.x;
                    if (onePoint.y < minY) minY = onePoint.y;
                    if (onePoint.x > maxX) maxX = onePoint.x;
                    if (onePoint.y > maxY) maxY = onePoint.y;
                }
            }
            for (let i = 0; i < footprint.length; ++i) {
                for (let j = 0; j < footprint[i].vertices.length; ++j) {
                    let onePoint = footprint[i].vertices[j];
                    onePoint.x = onePoint.x - minX;
                    onePoint.y = onePoint.y -minY;
                }
            }
            EditorModel.normalizedFootprintSize = {width: maxX - minX, height: maxY - minY};
            return footprint;
        } else {
            EditorModel.normalizedFootprintSize = {width: 1, height: 1};
            return footprint;
        }
    }

    public static fetchAndUpdateFootprint(footprintId: string): void {
        let footprint: FootprintPolygon[] = [];
        axios.get('http://localhost/e/api/0.6/way/' + footprintId + '/full', config)
            .then(response => {
                let domParser = new DOMParser();
                let xmlDocument = domParser.parseFromString(response.data, "text/xml");
                console.log(xmlDocument);
                let all_nodes_map = {};
                let all_nodes = xmlDocument.getElementsByTagName('node');
                for (let i = 0; i < all_nodes.length; i++) {
                    all_nodes_map[all_nodes[i].getAttribute('id')] = {
                        lat: parseFloat(all_nodes[i].getAttribute('lat')),
                        lon: parseFloat(all_nodes[i].getAttribute('lon')),
                    }
                }
                console.log(all_nodes_map);
                let all_node_ids = xmlDocument.getElementsByTagName('nd');
                // Currently, we assume only ONE footprint is passed in from iD!
                let footprint: FootprintPolygon[] = [];
                let allVertices: IGeoPoint[] = [];
                for (let i = 0; i < all_node_ids.length; i++) {
                    let id = all_node_ids[i].getAttribute('ref');
                    if (allVertices.length == 0 || id != allVertices[0].nodeId) {
                        allVertices.push({x: all_nodes_map[id].lon*1000, y: -all_nodes_map[id].lat*1000,
                                          isSelected: false, nodeId: id});
                    }
                }
                footprint.push({vertices: allVertices});
                console.log(allVertices);
                store.dispatch(updateFootprint(this.normalizeFootprint(footprint)));
                // Get the image ids and urls from the tag of current footprint
                // (later this should be returned by backend API after getting footprint as request.
                // the reason to need image id is that: if multiple urls returned and multiple of
                // them have alrady uploaded assoications, we need ids to pair them up first before
                // further updating)
                let all_footprint_tags = xmlDocument.getElementsByTagName('tag');
                let image_id = null;
                for (let i = 0; i < all_footprint_tags.length; i++) {
                    if (all_footprint_tags[i].getAttribute('k') === 'noter_image_id') {
                        image_id = all_footprint_tags[i].getAttribute('v');
                        break;
                    }
                }
                if (image_id !== null) {
                    // assume the pattern: 1,e3363734-a3cc.jpg:2,9bd0-a8f9a17690fc.jpg
                    let image_urls = image_id.split(":");
                    let image_ids = [];
                    for (let i = 0; i < image_urls.length; i++) {
                        const id_url = image_urls[i].split(",");
                        image_urls[i] = "http://localhost/nb/media/" + id_url[1];
                        image_ids.push(id_url[0]);
                    }
                    this.fetchAndUpdateImageData(footprintId, image_urls, image_ids);
                } else{
                    window.alert("No images in database within the vicinity of the input footprint, please upload manually!");
                }
        })
        .catch(function (error) {
            console.log(error);
        });
    }

    // Right now, we pass in image urls and ids. Later on, just pass in footprint information and then use it to fetch
    // all image urls and ids.
    public static fetchAndUpdateImageData(footprintId: string, image_urls: string[], image_ids: string[], ): void {
        //use the image urls and ids to construct the imageData
        const imageData: ImageData[] = [];
        for (let i = 0; i < image_urls.length; i++) {
            imageData.push({
                id: uuidv1(),
                fileData: {
                    name: "building" + i + 1 + ".jpg",
                    url: image_urls[i],
                    size: 1000
                },
                loadStatus: false,
                labelRects: [],
                labelPoints: [],
                labelLines: [],
                labelPolygons: [],
                buildingMetadata: JSON.parse(JSON.stringify(LabelsSelector.getBuildingMetadata())),
                uploadResponse: {data: {id: image_ids[i]}},
                annotationsResponse: "",
                associationsResponse: "",
                lastUploadedAssociations: [],
                isVisitedByObjectDetector: false,
                isVisitedByPoseDetector: false
            });
        }
        store.dispatch(addImageData(imageData));
        store.dispatch(updateActiveImageIndex(0));
        // further check if need to fill in image data with existing annotations and associations.
        this.fetchAssociations(footprintId, imageData);
    }

    // fetch annotations based on the assumption that, each imageData has its annotation id
    // inside annotationResponse. Now it's done by the assocation process. Later it should be
    // done by fetchAndUpdateImageData with annotation ids as inputs.
    public static fetchAnnotations(imageData: ImageData[]) {
        let all_annotation_ids = [];
        let image_data_indices = [];
        for (let i = 0; i < imageData.length; ++i) {
            if (imageData[i].annotationsResponse &&
                imageData[i].annotationsResponse.data.id) {
                all_annotation_ids.push(imageData[i].annotationsResponse.data.id);
                image_data_indices.push(i);
            }
        }
        const allRequests = [];
        for (let i = 0; i < all_annotation_ids.length; ++i) {
            const request = axios.get('http://localhost/nb/api/v0.1/annotations/' + all_annotation_ids[i] + '/');
            allRequests.push(request);
        }
        axios.all(allRequests)
            .then(axios.spread((...responses) => {
                // construct the annotations
                for (let i = 0; i < responses.length; ++i) {
                    imageData[image_data_indices[i]].annotationsResponse = responses[i];
                    imageData[image_data_indices[i]].labelPolygons =
                        this.getPolygonLabels(responses[i]);
                }
                // now we can update the the associations in each image to replace the facadeId with real id,
                // which is available now.
                for (let i = 0; i < imageData.length; ++i) {
                    for (let j = 0; j < imageData[i].buildingMetadata.associations.length; ++j) {
                        const facadeInfo = imageData[i].buildingMetadata.associations[j].facadeId.split(":");
                        imageData[i].buildingMetadata.associations[j].facadeId =
                            imageData[i].labelPolygons[facadeInfo[2]].id;
                    }
                    // set up the last uploaded associations to avoid uploading if no modifications
                    imageData[i].lastUploadedAssociations =
                        JSON.parse(JSON.stringify(imageData[i].buildingMetadata.associations));
                }
                // ready to refresh UI for the annotations
                store.dispatch(updateActiveImageIndex(0));
            }))
            .catch(error => {
                console.log(error);
            })
    }

    // extract the polygon labels from the annottion response
    public static getPolygonLabels(annotationsResponse: any): LabelPolygon[] {
        const content = JSON.parse(annotationsResponse.data.content_json);
        console.log(content);
        let annotations: LabelPolygon[] = [];
        let polygonsJSON = content['POLYGONS_VGG_JSON']
        for (let imageFileName in polygonsJSON) {
            console.log(imageFileName);
            const regions = polygonsJSON[imageFileName].regions;
            for (let index in regions) {
                const oneLabelPolygon: LabelPolygon = {
                    id: uuidv1(),
                    labelId: 'facade',
                    vertices: []
                };
                const all_x = regions[index].shape_attributes.all_points_x;
                const all_y = regions[index].shape_attributes.all_points_y;
                // to simulate the polgon that would reproduce the content_json
                // we get above to avoid reuploading same thing, need to avoid
                // the last extra points!!!
                for (let j = 0; j< all_x.length - 1; ++j) {
                    oneLabelPolygon.vertices.push({x: all_x[j],
                                                   y: all_y[j]})
                }
                annotations.push(oneLabelPolygon);
            }
        }
        console.log(annotations);

        return annotations;
    }

    // Fetch all relations the current footprint is involved. Each relation
    // is for one image-footprint pair. Then we can loop these relations to build imageData
    // for each relation: if such relation's imageId is inside image_ids, we can use this relation's
    // annotationId to retrive the annotation and reconstrut the labelPolygons[]. Then we can this
    // relation's association to reconstruct the associations[] (replace facade index with newly added
    // facadeId)
    public static fetchAssociations(footprintId: string, imageData: ImageData[]) {
        // fetch the relation first
        axios.get('http://localhost/e/api/0.6/way/' + footprintId + '/relations', config)
            .then(response => {
                let domParser = new DOMParser();
                let xmlDocument = domParser.parseFromString(response.data, "text/xml");
                console.log(xmlDocument);
                // collect all the ids for these lines within each relation, which encodes informtion
                // of annotaed facade (imageId+annotationId+polygonIndex) and one side of footprint(
                // the id of the nodes indise the footprint)
                let all_frontline_ids = [];
                let all_relations = xmlDocument.getElementsByTagName('relation');
                for (let i = 0; i < all_relations.length; ++i) {
                    // extract relation id and save it to corresponding imageData
                    this.addOneRelation(all_relations[i], imageData);
                    // extract all memebers except the footprint
                    let all_members = all_relations[i].getElementsByTagName('member');
                    for (let j = 0; j < all_members.length; ++j) {
                        const memeber_ref = all_members[j].getAttribute('ref');
                        if (memeber_ref !== footprintId) {
                            console.log(memeber_ref);
                            all_frontline_ids.push(memeber_ref);
                        }
                    }
                }
                // fetch all associations related to the current footprint
                const allRequests = [];
                for (let i = 0; i < all_frontline_ids.length; ++i) {
                    const request = axios.get('http://localhost/e/api/0.6/way/' + all_frontline_ids[i],
                                              config);
                    allRequests.push(request);
                }
                axios.all(allRequests)
                    .then(axios.spread((...responses) => {
                        for (let i = 0; i < responses.length; ++i) {
                            this.addOneAssoication(responses[i], imageData, all_frontline_ids[i]);
                        }
                        // fetch all annotations for imageData
                        this.fetchAnnotations(imageData);
                    }))
                    .catch(error => {
                        console.log(error);
                    })
        })
        .catch(function (error) {
            console.log(error);
        });
    }

    // collect the noter image id involved in the current relation and usee this
    // id find the correpsponding image and save id of this relation to this
    // imageData (this is part of the association response that will be used in first time
    // uploading)
    public static addOneRelation(oneRelationElement: any, imageData: ImageData[]) {
                const oneRelationId = oneRelationElement.getAttribute('id');
                let all_tags = oneRelationElement.getElementsByTagName('tag');
                let imageId = null;
                for (let i = 0; i < all_tags.length; i++) {
                    if (all_tags[i].getAttribute('k') === 'noter_image_id') {
                      imageId = all_tags[i].getAttribute('v');
                      break;
                    }
                }
                if (imageId !== null) {
                    const targetImage = findLast(imageData, (oneImageData) => {
                        return oneImageData.uploadResponse.data.id === imageId;
                    });
                    if (!!targetImage) {
                        targetImage.associationsResponse = {relationId: oneRelationId,
                                                            lineMemberIds: []};
                    } else {
                      console.log("can't find image for current relation!");
                    }
                }
    }

    // Based on the imageId inside the current frontline, we can figure out which imageData
    // to add current association.
    public static addOneAssoication(oneFrontlineResponse: any, imageData:
                                    ImageData[], oneFrontlineId: string) {
        // first, parse response to get the node ids for two ending points and facadeId
        // from facadeId, we can get: imageId, annotationId and facade polygon index
        // the annotationId can be assigned to annotationResponse. So the next fetch annotation
        // can use it. Later, we should switch the order and get annotations first.
        // second, build one association using above information (for facadeId, keep it
        // as it is and we need to update it into real facadeId later once having the
        // annotations rebuilt)
        let domParser = new DOMParser();
        let xmlDocument = domParser.parseFromString(oneFrontlineResponse.data, "text/xml");
        const oneAssociation = {
            facadeId: "",
            polygonIndex: 0,
            indices: []
        };
        const footprintVertices = LabelsSelector.getBuildingMetadata().footprint[0].vertices;
        let all_node_ids = xmlDocument.getElementsByTagName('nd');
        for (let i = 0; i < all_node_ids.length; i++) {
            let id = all_node_ids[i].getAttribute('ref');
            for (let j = 0; j < footprintVertices.length; ++j) {
                if (footprintVertices[j].nodeId === id) {
                    oneAssociation.indices.push(j);
                    break;
                }
            }
        }
        let all_tags = xmlDocument.getElementsByTagName('tag');
        let facadeId = null;
        for (let i = 0; i < all_tags.length; i++) {
            if (all_tags[i].getAttribute('k') === 'facadeId') {
                facadeId = all_tags[i].getAttribute('v');
                break;
            }
        }
        if (facadeId !== null) {
            oneAssociation.facadeId = facadeId;
        } else {
            return;
        }
        // use current facadeId to update the annotation id for the imageData
        // ( if multiple associtions are from same image, they should share
        // the same annotation id!!!)
        const annotationInfo = facadeId.split(":");
        for (let i = 0; i < imageData.length; ++i) {
            if (imageData[i].uploadResponse.data.id === annotationInfo[0]) {
                imageData[i].buildingMetadata.associations.push(oneAssociation);
                imageData[i].annotationsResponse = {data: {id: annotationInfo[1]}};
                if (!!imageData[i].associationsResponse) {
                    imageData[i].associationsResponse.lineMemberIds.push(oneFrontlineId);
                }
                console.log(imageData[i]);
                break;
            }
        }
    }

    public static resizeFootprint(normalizedFootprint: FootprintPolygon[], viewPortSize: ISize): FootprintPolygon[] {
        let footprint = JSON.parse(JSON.stringify(normalizedFootprint));
        const border = 10;
        let innerViewPort = {height: viewPortSize.height - border, width: viewPortSize.width - border};
        let scaleFactor = Math.min(innerViewPort.height / EditorModel.normalizedFootprintSize.height,
                                   innerViewPort.width / EditorModel.normalizedFootprintSize.width);
        let shiftOffset: IPoint =
            {x: (innerViewPort.width - EditorModel.normalizedFootprintSize.width * scaleFactor) / 2 + border / 2,
             y: (innerViewPort.height - EditorModel.normalizedFootprintSize.height * scaleFactor) / 2 + border / 2};
        for (let i = 0; i < footprint.length; ++i) {
            for (let j = 0; j < footprint[i].vertices.length; ++j) {
                let onePoint = footprint[i].vertices[j];
                onePoint.x = onePoint.x * scaleFactor + shiftOffset.x;
                onePoint.y = onePoint.y * scaleFactor + shiftOffset.y;
            }
        }
        EditorModel.footprintScaleFactor = scaleFactor;
        EditorModel.footprintShift = shiftOffset;
        return footprint;
    }

    public static resizeOnePoint(point: IPoint) {
        return {...point,
                x: point.x * EditorModel.footprintScaleFactor + EditorModel.footprintShift.x,
                y: point.y * EditorModel.footprintScaleFactor + EditorModel.footprintShift.y}
    }

    public static availableForAssociation():boolean {
        let buildingMetadata = LabelsSelector.getBuildingMetadata();
        let availablePointNum = 0;
        for (let i = 0; i < buildingMetadata.footprint.length; ++i) {
            for (let j = 0; j < buildingMetadata.footprint[i].vertices.length; ++j) {
                if (buildingMetadata.footprint[i].vertices[j].isSelected) {
                    ++ availablePointNum;
                    if (availablePointNum >= 2)
                        return true;
                }
            }
        }
        return false;
    }

    public static alreadyAssociated(facadeId: string): boolean {
        let buildingMetadata = LabelsSelector.getBuildingMetadata();
        console.log("facadeId to check: " + facadeId)
        for (let i = 0; i < buildingMetadata.associations.length; ++i) {
            console.log(buildingMetadata.associations[i].facadeId)
            if (buildingMetadata.associations[i].facadeId === facadeId) {
                console.log("found matching!");
                return true;
            }
        }
        return false;
    }
}
