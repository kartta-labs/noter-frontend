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
            // TODO: Make this async.
            this.uploadImage(imagesData[i], labelNames[i]);
        }        
    }

    private static uploadImage(imageData: ImageData, labelName: LabelName): void {
        const formData = new FormData();
        const annotations = {};
        this.addPointLabels(annotations, imageData, labelName);
        this.addRectLabels(annotations, imageData, labelName);
        this.addLineLabels(annotations, imageData, labelName);
        this.addPolygonLabels(annotations, imageData, labelName);
        formData.append("annotations", JSON.stringify(annotations));
        this.submitToApi(formData, imageData);
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

    private static submitToApi(formData: FormData, imageData: ImageData): void {
        if(!imageData.response || !imageData.response.data.pk) {
            formData.append("image", imageData.fileData);
            axios.post(process.env.REACT_APP_BACKEND_URL+"/api/images/", formData)
            .then(response => {
                imageData.response = response;
                console.log(response);
            })
            .catch(function (error) {
                console.log(error);
            });
        } else if (imageData.response.data.annotations != formData.get("annotations")) {
            axios.put(process.env.REACT_APP_BACKEND_URL+"/api/images/"+imageData.response.data.pk+"/", formData)
            .then(response => {
                imageData.response = response;
                console.log("sent a put.");
                console.log(response);
            })
            .catch(function (error) {
                console.log(error);
            });
        }
    }
}