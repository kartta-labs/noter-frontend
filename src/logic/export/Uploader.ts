import {ExportFormatType} from "../../data/enums/ExportFormatType";
import {IPoint} from "../../interfaces/IPoint";
import {VGGFileData, VGGObject, VGGPolygon, VGGRegionsData} from "../../data/VGG/IVGG";
import {ImageData, LabelName, LabelPolygon} from "../../store/labels/types";
import {LabelsSelector} from "../../store/selectors/LabelsSelector";
import {store} from "../../index";
import {PopupWindowType} from "../../data/enums/PopupWindowType";
import {updateActivePopupType} from "../../store/general/actionCreators";
import {EditorModel} from "../../staticModels/EditorModel";
import {saveAs} from "file-saver";
import {ExporterUtil} from "../../utils/ExporterUtil";
import {PolygonLabelsExporter} from "./PolygonLabelsExporter";
import {LineLabelsExporter} from "./LineLabelExport";
import {RectLabelsExporter} from "./RectLabelsExporter";
import {PointLabelsExporter} from "./PointLabelsExport";
import {findLast} from "lodash";
import axios from 'axios';

const config = {
    headers: {'Content-Type': 'text/xml'},
    withCredentials: true
};
let isUploadDone = {};

export class Uploader {
    // Uploads a single image.
    public static uploadAll(): void {
        // start the progress bar
        store.dispatch(updateActivePopupType(PopupWindowType.LOADER));

        const imagesData: ImageData[] = LabelsSelector.getImagesData();
        const labelNames: LabelName[] = LabelsSelector.getLabelNames();
        const activeImageIndex = LabelsSelector.getActiveImageIndex();
        // copy the work area buildingMetadata to active imageData to sync
        imagesData[activeImageIndex].buildingMetadata =
            JSON.parse(JSON.stringify(LabelsSelector.getBuildingMetadata()));
        console.log(imagesData[activeImageIndex]);
        //set up the status check for all images.
        isUploadDone = {};
        for (let i=0; i < imagesData.length; i++) {
            isUploadDone[imagesData[i].id] = false;
        }
        for (let i=0; i < imagesData.length; i++)
        {
            this.uploadImageAndAnnotations(imagesData[i], labelNames[0]);
        }
        //keep on checking to make sure upload for all images is done
        this.checkAllDone();
    }

    private static async checkAllDone() {
        let allDone = false;
        while (!allDone) {
            allDone = true;
            for (let id in isUploadDone) {
                if (!isUploadDone[id]) {
                    allDone = false;
                    break;
                }
            }
            // wait 1 second
            await new Promise(r => setTimeout(r, 500));
        }
        store.dispatch(updateActivePopupType(null));
    }

    private static collectAnnotations(imageData: ImageData, labelName: LabelName): any {
        const annotations = {};
        this.addPointLabels(annotations, imageData, labelName);
        this.addRectLabels(annotations, imageData, labelName);
        this.addLineLabels(annotations, imageData, labelName);
        this.addPolygonLabels(annotations, imageData, labelName);
        return annotations;
    }

    private static uploadImageAndAnnotations(imageData: ImageData, labelName: LabelName): void {
        if (!imageData.uploadResponse || !imageData.uploadResponse.data.id) {
            // If image is not already uploaded
            this.uploadImageThenAnnotation(imageData, labelName);
        } else {
          //further check if annotations should be uploaded
          const annotations = this.collectAnnotations(imageData, labelName);
          if (!imageData.annotationsResponse || imageData.annotationsResponse.data.content_json
                   != JSON.stringify(annotations)) {
            this.uploadOnlyAnnotations(annotations, imageData);
          } else {
            console.log("same annotations, try to check associations...");
            const sortedCurrent = imageData.buildingMetadata.associations.slice().sort();
            const sortedLastUploaded = imageData.lastUploadedAssociations.slice().sort();
            if (JSON.stringify(sortedCurrent) === JSON.stringify(sortedLastUploaded)) {
                isUploadDone[imageData.id] = true;
                console.log("same associations too, no uploading!");
            } else {
                console.log("different associations, uploading!");
                this.uploadAssociations(imageData);
            }
        }
      }
    }

    private static addPointLabels(annotations: any, imageData: ImageData, labelName: LabelName): void {
        const content : any = PointLabelsExporter.wrapRectLabelsIntoCSV(imageData);
        if(!!content){
            annotations["POINT_CSV"] = content;
        }
    }
    private static addRectLabels(annotations: any, imageData: ImageData, labelName: LabelName): void {
        const content : any = RectLabelsExporter.wrapRectLabelsIntoCSV(imageData);
        if(!!content){
            annotations["RECT_CSV"] = content;
        }
    }
    private static addLineLabels(annotations: any, imageData: ImageData, labelName: LabelName): void {
        const content : any = LineLabelsExporter.wrapLineLabelsIntoCSV(imageData);
        if(!!content){
            annotations["LINES_CSV"] = content;
        }
    }
    private static addPolygonLabels(annotations: any, imageData: ImageData, labelName: LabelName): void {
        const content : any = PolygonLabelsExporter.mapImagesDataToVGGObject([imageData], [labelName]);
        if(!!content && Object.keys(content).length > 0){
            annotations["POLYGONS_VGG_JSON"] = content;
        }
    }

    private static uploadImageThenAnnotation(imageData: ImageData, labelName: LabelName): void {
        const formData = new FormData();
        // for images to upload, there are two types:
        // first, image as url link from cloud bucket
        // second, image as file object from local drive
        if (imageData.fileData instanceof File) {
          formData.append("image", imageData.fileData as File);
        } else {
          formData.append("image", new File([""], "dummy.jpg"));
          formData.append("url", imageData.fileData.url);
        }
        // set up isPublic properly
        if (imageData.isPublic) {
          formData.append("public", "true");
        }
        // TODO: We hardcode the project_id here, but it needs to be fetched and set properly.
        formData.append("project_id", "1");
        let metadata_object =
          !!imageData.imageMetadata?JSON.parse(imageData.imageMetadata):{};
        metadata_object.imagename = imageData.fileData.name;
        // make sure for image as url case, we put this info in the description
        if (!(imageData.fileData instanceof File)) {
          metadata_object.image_url = imageData.fileData.url;
        }
        formData.append("description", JSON.stringify(metadata_object));
        console.log(formData);
        console.log(imageData.fileData);
        axios.post(process.env.REACT_APP_BACKEND_URL+"/nb/api/v0.1/images/", formData)
        .then(response => {
            imageData.uploadResponse = response;
            console.log(response);
            const annotations = this.collectAnnotations(imageData, labelName);
            this.uploadOnlyAnnotations(annotations, imageData);
        })
        .catch(function (error) {
            console.log(error);
        });
    }

    private static uploadOnlyAnnotations(annotations, imageData: ImageData): void {
        if (Object.keys(annotations).length === 0) {
            // update the DONE status for upload
            isUploadDone[imageData.id] = true;
            return;
        }
        const formData = new FormData();
        formData.append("content_json", JSON.stringify(annotations))
        formData.append("image_id", imageData.uploadResponse.data.id)
        console.log("try to upload for image:" + imageData.uploadResponse.data.id);
        console.log(JSON.stringify(annotations));
        console.log(imageData);
        axios.post(process.env.REACT_APP_BACKEND_URL+"/nb/api/v0.1/annotations/", formData)
        .then(response => {
            imageData.annotationsResponse = response;
            console.log("get reponse for image: " + imageData.uploadResponse.data.id);
            console.log(imageData.annotationsResponse);
            this.uploadAssociations(imageData);
        })
        .catch(function (error) {
            console.log(error);
        });
    }

    private static relationCreationRequest(changesetId: string, footprintId: string,
                                           wayIds: string[], image_id: string, image_name: string,
                                           annotation_id: string): string {
        let createOneRelationTemplate =
            `<?xml version="1.0" encoding="UTF-8"?>
               <osm>
                 <relation changeset="changesetId">
                   <tag k="noter_image_id" v="noterImageIdPlaceHolder"/>
                   <tag k="noter_image_name" v="noterImageNamePlaceHolder"/>
                   <tag k="noter_annotation_id" v="noterAnnotationIdPlaceHolder"/>
                   memberPlaceHolder
                 </relation>
               </osm>`;
        let oneMemeberTemplate =
            `<member type="way" ref="wayIdPlaceHolder" role="rolePlaceHolder"/>
             memberPlaceHolder`;
        createOneRelationTemplate =
            createOneRelationTemplate.replace('changesetId', changesetId);
        createOneRelationTemplate =
            createOneRelationTemplate.replace('noterImageIdPlaceHolder', image_id);
        createOneRelationTemplate =
            createOneRelationTemplate.replace('noterImageNamePlaceHolder', image_name);
        createOneRelationTemplate =
            createOneRelationTemplate.replace('noterAnnotationIdPlaceHolder', annotation_id);
        const allWayIds = [];
        Object.assign(allWayIds, wayIds);
        // create one member with footprint
        let oneMember = oneMemeberTemplate.replace('wayIdPlaceHolder', footprintId);
        oneMember = oneMember.replace('rolePlaceHolder', 'footprint');
        createOneRelationTemplate =
                createOneRelationTemplate.replace('memberPlaceHolder', oneMember);
        // create one member for each way (facadeline)
        for (let i = 0; i < allWayIds.length; ++i) {
            let oneMember = oneMemeberTemplate.replace('wayIdPlaceHolder', allWayIds[i]);
            oneMember = oneMember.replace('rolePlaceHolder', 'facadeline');
            createOneRelationTemplate =
                createOneRelationTemplate.replace('memberPlaceHolder', oneMember);
        }
        createOneRelationTemplate =
            createOneRelationTemplate.replace('memberPlaceHolder', '');
        return createOneRelationTemplate;
    }

    private static closeAssociationUpload(changesetId: string) {
        axios.put(process.env.REACT_APP_BACKEND_URL + '/e/api/0.6/changeset/' + changesetId +'/close', '', config)
            .then(response => {
                console.log(response.data)
            })
            .catch(function (error) {
                console.log(error);
            });
    }
    private static createAndUploadRelation(imageData: ImageData, changesetId: string,
                                           footprintId: string, lineIds: string[]): void {
        axios.put(process.env.REACT_APP_BACKEND_URL + '/e/api/0.6/relation/create',
                  this.relationCreationRequest(changesetId, footprintId,
                                               lineIds,
                                               imageData.uploadResponse.data.id,
                                               imageData.fileData.name,
                                               imageData.annotationsResponse.data.id),
                  config)
            .then(response => {
                // update the associationsResponse inside imageData
                // check if any existing associations uploaded for current image. If so,
                // delete them before upload.
                if (!!imageData.associationsResponse) {
                    this.deleteUploadedAssociations(imageData, changesetId,
                                                    response.data, lineIds);
                } else {
                    imageData.associationsResponse = {relationId: response.data,
                                                      lineMemberIds: []};
                    for (let i = 0; i < lineIds.length; ++i) {
                        imageData.associationsResponse.lineMemberIds.push(lineIds[i]);
                    }
                    console.log(imageData.associationsResponse);
                    this.closeAssociationUpload(changesetId);
                    isUploadDone[imageData.id] = true;
                }

            })
            .catch(function (error) {
                console.log(error);
            });
    }

    // delete the previously uploaded associations
    private static deleteUploadedAssociations(imageData: ImageData, changesetId: string,
                                              newRelationId: string, newLineIds: string[]) {
        // delete the relation first
        const relationId = imageData.associationsResponse.relationId;
        console.log("relation id to delete:" + relationId);
        axios.delete(process.env.REACT_APP_BACKEND_URL + '/e/api/0.6/relation/' + relationId,
                     this.wayDeleteRequest(changesetId, "relation", relationId))
            .then(response => {
                // delete all the memeber lines within the relation (except the footprint!)
                const lineMemberIds = imageData.associationsResponse.lineMemberIds;
                const allRequests = [];
                for (let i = 0; i < lineMemberIds.length; ++i) {
                    const request = axios.delete(process.env.REACT_APP_BACKEND_URL + '/e/api/0.6/way/' + lineMemberIds[i],
                                                 this.wayDeleteRequest(changesetId, "way", lineMemberIds[i]));
                    allRequests.push(request);
                }
                axios.all(allRequests)
                    .then(axios.spread((...responses) => {
                        // update the associationsResponse
                        imageData.associationsResponse = {relationId: newRelationId,
                                                          lineMemberIds: []};
                        for (let i = 0; i < newLineIds.length; ++i) {
                            imageData.associationsResponse.lineMemberIds.push(newLineIds[i]);
                        }
                        // now we can close the current changeset
                        this.closeAssociationUpload(changesetId);
                        // update DONE status
                        isUploadDone[imageData.id] = true;
                    }))
                    .catch(function (error) {
                        console.log(error);
                    });
            })
            .catch(function (error) {
                console.log(error);
            });
    }

    // delete request in axios doesn't take data directly, need to add it into the config.
    private static wayDeleteRequest(changesetId: string, fetureType: string,
                                    featureId: string): any {
        const deleteConfig = {
            headers: {'Content-Type': 'text/xml'},
            withCredentials: true,
            data: ''
        };

        let wayDeleteTemplate =
            `<?xml version="1.0" encoding="UTF-8"?>
               <osm>
                 <fetureType id="featureId" version="1" changeset="changesetId"/>
               </osm>`;
        deleteConfig.data = wayDeleteTemplate.replace('changesetId', changesetId)
            .replace('fetureType', fetureType)
            .replace('featureId', featureId);
        return deleteConfig;
    }

    private static wayCreationRequest(changesetId: string, allNodeIds: string[],
                                      facadeId: string): string {
        let createOneLineTemplate =
            `<?xml version="1.0" encoding="UTF-8"?>
               <osm>
                 <way changeset="changesetId">
                   <tag k="association" v="yes"/>
                   <tag k="facadeId" v="facadeIdPlaceHolder"/>
                   nodePlaceHolder
                 </way>
               </osm>`;
        let oneNodeTemplate =
            `<nd ref="nodeIdPlaceHolder"/>
             nodePlaceHolder`;
        createOneLineTemplate = createOneLineTemplate.replace('changesetId', changesetId)
            .replace('facadeIdPlaceHolder', facadeId);

        for (let i = 0; i < allNodeIds.length; ++i) {
            let oneNode = oneNodeTemplate.replace('nodeIdPlaceHolder', allNodeIds[i]);
            createOneLineTemplate =
                createOneLineTemplate.replace('nodePlaceHolder', oneNode);
        }
        createOneLineTemplate =
            createOneLineTemplate.replace('nodePlaceHolder', '');
        return createOneLineTemplate;
    }

    // The unique id of each annotated facade is only used in the current session. To save into DB,
    // we need to convert it into the index in the annotations of current image. Also, we need to
    // append image id and annotation id to this index since they are needed to finally make this
    // index meaningful.
    private static constructFacadeId(originalId: string, imageData: ImageData): string {
        let facadeId = imageData.uploadResponse.data.id + ":" + imageData.annotationsResponse.data.id;
        for (let i = 0; i< imageData.labelPolygons.length; ++i) {
            if (imageData.labelPolygons[i].id === originalId) {
                facadeId += ":" + i.toString();
            }
        }
        return facadeId;
    }

    private static distanceBetweenPoints (p1: IPoint, p2: IPoint) {
        return Math.abs(Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y)));
    }

    private static distanceToLineSegment (p: IPoint, p1: IPoint, p2: IPoint) {
        return Math.abs((p2.y - p1.y)*p.x - (p2.x - p1.x)*p.y + p2.x*p1.y - p2.y*p1.x) / this.distanceBetweenPoints(p1, p2);
    }

    // Given a list of vertices and two indices of vertices, which represent the
    // two ending points of one straight line, figure out the indices of
    // vertices on this line
    private static orderAndFillGap (vertices, twoIndices: number[]): number[] {
      let minAveragePerpendicularDistnace = -1
      let result = [];
      // try the line with vertices between index1 ---> index2 and index2
      // --->index1 and chhose these with minAveragePerpendicularDistnace
      for (let i = 0; i < 2; ++i) {
        let start  = twoIndices[0];
        let end = twoIndices[1];
        if (i == 1) {
          [start, end] = [end, start]
        }
        let perpendicularDistnaceSum = 0;
        let vertexNum = 0;
        let allIndices =[];
        for (let index = start; index != end && vertexNum <= vertices.length; index = (index + 1) % vertices.length) {
          perpendicularDistnaceSum += this.distanceToLineSegment(vertices[index],
                                                            vertices[start],
                                                            vertices[end]);
          vertexNum ++;
          allIndices.push(index);
        }
        // add last one
        allIndices.push(end);
        vertexNum ++;
        // compute distance
        const average = perpendicularDistnaceSum /= vertexNum;
        if (minAveragePerpendicularDistnace < 0 || average < minAveragePerpendicularDistnace) {
          minAveragePerpendicularDistnace = average;
          result = allIndices;
        }
      }
      console.log(result);
      return result;
    }

    // In each association, the selected frontline, consists of a number of edges and each edge
    // is represented by its one eding point.
    // First, convert them into the underlying points, which are the expected in
    // the downstream
    // Second, these points should NOT have gap and should be consecutive.
    // To handle potential user annotation gaps, we use the following simple
    // method by assuming the two points on the two ending sides are always
    // there
    // 1. find the two ending points using the pair with longest distance (if
    // more than two points in the frontline)
    // 2. figure out the line should be p1--->p2, or p2--->p1 by choosing the
    // one with minimum average point to segment [p1, p2] distance. then all
    // consecutive points in between would be the result
    private static getConsecutiveFrontIndices(buildingMetadata, associationIndex: number): number[]{
      // convert edge index into point indices
      const polygonIndex = buildingMetadata.associations[associationIndex].polygonIndex;
      const allVertices = buildingMetadata.footprint[polygonIndex].vertices;
      const allLineIndices =
        buildingMetadata.associations[associationIndex].indices;
      const allpointIndices = [...allLineIndices];
      console.log(allLineIndices);
      for (let i = 0; i < allLineIndices.length; ++i) {
        const next = (allLineIndices[i] + 1) % allVertices.length;
        if (allpointIndices.indexOf(next) < 0) {
          allpointIndices.push(next);
        }
      }
      console.log(allpointIndices);
      // order and fill in gap
      if (allpointIndices.length == 2) {
        return this.orderAndFillGap(allVertices, allpointIndices);
      } else {
        // find the two points with maximum distance as two ending points
        let maxDistance = -1;
        let endingPoints = [];
        for (let i = 0; i < allpointIndices.length; ++i) {
          for (let j = i + 1; j < allpointIndices.length; ++j) {
            const distance = this.distanceBetweenPoints(allVertices[allpointIndices[i]],
                                                  allVertices[allpointIndices[j]]);
            if (distance > maxDistance) {
              maxDistance = distance;
              endingPoints = [allpointIndices[i], allpointIndices[j]];
            }
          }
        }
        //order and fill in gap
        console.log(endingPoints);
        return this.orderAndFillGap(allVertices, endingPoints);
      }
    }

    private static createAndUploadLines(imageData: ImageData, changesetId: string): void {
        const allRequests = [];
        const buildingMetadata = imageData.buildingMetadata;
        for (let i = 0; i < buildingMetadata.associations.length; ++i) {
            const facadeId = this.constructFacadeId(buildingMetadata.associations[i].facadeId, imageData);
            const polygonIndex = buildingMetadata.associations[i].polygonIndex;

            const firstNodeIndex = buildingMetadata.associations[i].indices[0];
            const secondNodeIndex = buildingMetadata.associations[i]
                .indices[buildingMetadata.associations[i].indices.length - 1];
            const firstNodeId = buildingMetadata.footprint[polygonIndex].vertices[firstNodeIndex].nodeId;
            const secondNodeId = buildingMetadata.footprint[polygonIndex].vertices[secondNodeIndex].nodeId;

            // ideally, the association should have all the consecutive indices
            // of all points. However, in reality, user annotation may miss some
            // middle ones. Also, they should be ordered properly to one valid
            // polyline. So need add pre-processing here to make sure these
            // before save them out
            const consecutiveFrontIndices = this.getConsecutiveFrontIndices(buildingMetadata, i);
            const allNodeIds = [];
            for (let j = 0; j < consecutiveFrontIndices.length; ++j) {
              const nodeIndex = consecutiveFrontIndices[j];
              const nodeId = buildingMetadata.footprint[polygonIndex].vertices[nodeIndex].nodeId;
              allNodeIds.push(nodeId);
            }

            const request = axios.put(process.env.REACT_APP_BACKEND_URL + '/e/api/0.6/way/create',
                                      this.wayCreationRequest(changesetId, allNodeIds, facadeId),
                                      config);
            allRequests.push(request);
        }
        axios.all(allRequests)
            .then(axios.spread((...responses) => {
                const lineIds = [];
                for (let i = 0; i < responses.length; ++i) {
                    lineIds.push(responses[i].data);
                    console.log(responses[i].data);
                }
                this.createAndUploadRelation(imageData, changesetId, EditorModel.footprintId, lineIds);
            }))
            .catch(error => {
                console.log(error);
            })
    }

    private static uploadAssociations(imageData: ImageData): void {
        let xmlCreateChangeset =
            `<?xml version="1.0" encoding="UTF-8"?>
               <osm>
                 <changeset>
                   <tag k="comment" v="changeset for uploading facade association"/>
                 </changeset>
              </osm>`
        const buildingMetadata = imageData.buildingMetadata;
        if (buildingMetadata.associations.length == 0) {
            isUploadDone[imageData.id] = true;
            return;
        }
        imageData.lastUploadedAssociations =
            JSON.parse(JSON.stringify(imageData.buildingMetadata.associations));
        axios.put(process.env.REACT_APP_BACKEND_URL + '/e/api/0.6/changeset/create', xmlCreateChangeset, config)
            .then(response => {
                this.createAndUploadLines(imageData, response.data);
            })
            .catch(function (error) {
                console.log(error);
            });
    }
}
