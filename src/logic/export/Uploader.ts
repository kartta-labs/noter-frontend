import {ExportFormatType} from "../../data/enums/ExportFormatType";
import {IPoint} from "../../interfaces/IPoint";
import {VGGFileData, VGGObject, VGGPolygon, VGGRegionsData} from "../../data/VGG/IVGG";
import {ImageData, LabelName, LabelPolygon} from "../../store/labels/types";
import {LabelsSelector} from "../../store/selectors/LabelsSelector";
import {saveAs} from "file-saver";
import {ExporterUtil} from "../../utils/ExporterUtil";
import {PolygonLabelsExporter} from "./PolygonLabelsExporter";
import {LineLabelsExporter} from "./LineLabelExport";
import {RectLabelsExporter} from "./RectLabelsExporter";
import {PointLabelsExporter} from "./PointLabelsExport";
import {findLast} from "lodash";
import axios from 'axios';

export class Uploader {
    // Uploads a single image.
    public static uploadAll(): void {
        const imagesData: ImageData[] = LabelsSelector.getImagesData();
        const labelNames: LabelName[] = LabelsSelector.getLabelNames();
        for (let i=0; i < imagesData.length; i++)
        {
            this.uploadImageAndAnnotations(imagesData[i], labelNames[i]);
        }        
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
        } else if (!imageData.annotationsResponse || imageData.annotationsResponse.data.content_json != JSON.stringify(annotations)) {
            this.uploadOnlyAnnotations(annotations, imageData);
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
        if(!!content){
            annotations["POLYGONS_VGG_JSON"] = content;
        }
    }

    private static uploadImageAndAnnotation(annotations, imageData: ImageData): void {
        const formData = new FormData();
        formData.append("image", imageData.fileData);
        // TODO: We hardcode the project_id here, but it needs to be fetched and set properly.
        formData.append("project_id", "1");
        axios.post(process.env.REACT_APP_BACKEND_URL+"/api/v0.1/images/", formData)
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
        const formData = new FormData();
        formData.append("content_json", JSON.stringify(annotations))
        formData.append("image_id", imageData.uploadResponse.data.id)

        axios.post(process.env.REACT_APP_BACKEND_URL+"/api/v0.1/annotations/", formData)
        .then(response => {
            imageData.annotationsResponse = response;
            console.log(response);
            console.log(imageData.annotationsResponse);
        })
        .catch(function (error) {
            console.log(error);
        });

    }
}