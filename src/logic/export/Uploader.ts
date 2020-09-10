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

    private static uploadImageAndAnnotations(imageData: ImageData, labelName: LabelName): void {
        const annotations = {};
        this.addPointLabels(annotations, imageData, labelName);
        this.addRectLabels(annotations, imageData, labelName);
        this.addLineLabels(annotations, imageData, labelName);
        this.addPolygonLabels(annotations, imageData, labelName);

        if (!imageData.uploadResponse || !imageData.uploadResponse.data.id) {
            // If image is not already uploaded
            this.uploadImageAndAnnotation(annotations, imageData);
        } else if (!imageData.annotationsResponse || imageData.annotationsResponse.data.content_json
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

    private static uploadImageAndAnnotation(annotations, imageData: ImageData): void {
        const formData = new FormData();
        formData.append("image", imageData.fileData as File);
        // TODO: We hardcode the project_id here, but it needs to be fetched and set properly.
        formData.append("project_id", "1");
        console.log(formData);
        console.log(imageData.fileData);
        axios.post(process.env.REACT_APP_BACKEND_URL+"/nb/api/v0.1/images/", formData)
        .then(response => {
            imageData.uploadResponse = response;
            console.log(response);
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
                                           wayIds: string[], image_id: string,
                                           annotation_id: string): string {
        let createOneRelationTemplate =
            `<?xml version="1.0" encoding="UTF-8"?>
               <osm>
                 <relation changeset="changesetId">
                   <tag k="noter_image_id" v="noterImageIdPlaceHolder"/>
                   <tag k="noter_annotation_id" v="noterAnnotationIdPlaceHolder"/>
                   memberPlaceHolder
                 </relation>
               </osm>`;
        let oneMemeberTemplate =
            `<member type="way" ref="wayIdPlaceHolder"/>
             memberPlaceHolder`;
        createOneRelationTemplate =
            createOneRelationTemplate.replace('changesetId', changesetId);
        createOneRelationTemplate =
            createOneRelationTemplate.replace('noterImageIdPlaceHolder', image_id);
        createOneRelationTemplate =
            createOneRelationTemplate.replace('noterAnnotationIdPlaceHolder', annotation_id);
        const allWayIds = [];
        Object.assign(allWayIds, wayIds);
        allWayIds.push(footprintId);
        for (let i = 0; i < allWayIds.length; ++i) {
            let oneMember = oneMemeberTemplate.replace('wayIdPlaceHolder', allWayIds[i]);
            createOneRelationTemplate =
                createOneRelationTemplate.replace('memberPlaceHolder', oneMember);
        }
        createOneRelationTemplate =
            createOneRelationTemplate.replace('memberPlaceHolder', '');
        return createOneRelationTemplate;
    }

    private static closeAssociationUpload(changesetId: string) {
        axios.put('http://localhost/e/api/0.6/changeset/' + changesetId +'/close', '', config)
            .then(response => {
                console.log(response.data)
            })
            .catch(function (error) {
                console.log(error);
            });
    }
    private static createAndUploadRelation(imageData: ImageData, changesetId: string,
                                           footprintId: string, lineIds: string[]): void {
        axios.put('http://localhost/e/api/0.6/relation/create',
                  this.relationCreationRequest(changesetId, footprintId,
                                               lineIds, imageData.uploadResponse.data.id,
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
        axios.delete('http://localhost/e/api/0.6/relation/' + relationId,
                     this.wayDeleteRequest(changesetId, "relation", relationId))
            .then(response => {
                // delete all the memeber lines within the relation (except the footprint!)
                const lineMemberIds = imageData.associationsResponse.lineMemberIds;
                const allRequests = [];
                for (let i = 0; i < lineMemberIds.length; ++i) {
                    const request = axios.delete('http://localhost/e/api/0.6/way/' + lineMemberIds[i],
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

    private static wayCreationRequest(changesetId: string, firstNodeId: string,
                                       secondNodeId: string, facadeId: string): string {
        let createOneLineTemplate =
            `<?xml version="1.0" encoding="UTF-8"?>
               <osm>
                 <way changeset="changesetId">
                   <tag k="note" v="facade frontline"/>
                   <tag k="facadeId" v="facadeIdPlaceHolder"/>
                   <nd ref="firstNodeId"/>
                   <nd ref="secondNodeId"/>
                 </way>
               </osm>`;
        return createOneLineTemplate.replace('changesetId', changesetId)
            .replace('firstNodeId', firstNodeId)
            .replace('secondNodeId', secondNodeId)
            .replace('facadeIdPlaceHolder', facadeId);
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
            const request = axios.put('http://localhost/e/api/0.6/way/create',
                                      this.wayCreationRequest(changesetId, firstNodeId, secondNodeId, facadeId),
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
        axios.put('http://localhost/e/api/0.6/changeset/create', xmlCreateChangeset, config)
            .then(response => {
                this.createAndUploadLines(imageData, response.data);
            })
            .catch(function (error) {
                console.log(error);
            });
    }
}
