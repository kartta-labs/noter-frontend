import {ExportFormatType} from "../../data/enums/ExportFormatType";
import {IPoint} from "../../interfaces/IPoint";
import {VGGFileData, VGGObject, VGGPolygon, VGGRegionsData} from "../../data/VGG/IVGG";
import {ImageData, LabelName, LabelPolygon} from "../../store/labels/types";
import {LabelsSelector} from "../../store/selectors/LabelsSelector";
import {saveAs} from "file-saver";
import {ExporterUtil} from "../../utils/ExporterUtil";
import {PolygonLabelsExporter} from "./PolygonLabelsExporter";
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
        formData.append("image", imageData.fileData);
        this.addPointLabels(formData);
        this.addRectLabels(formData);
        this.addLineLabels(formData);
        this.addPolygonLabels(formData, imageData, labelName);
        this.submitToApi(formData, imageData);
    }

    private static addPointLabels(formData: FormData): void {}
    private static addRectLabels(formData: FormData): void {}
    private static addLineLabels(formData: FormData): void {}
    private static addPolygonLabels(formData: FormData, imageData: ImageData, labelName: LabelName): void {
        const content: string = JSON.stringify({"VGG_JSON":PolygonLabelsExporter.mapImagesDataToVGGObject([imageData], [labelName])});
        formData.append("annotations", content);
    }

    private static submitToApi(formData: FormData, imageData: ImageData): void {
        if(!imageData.response || !imageData.response.data.pk) {
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