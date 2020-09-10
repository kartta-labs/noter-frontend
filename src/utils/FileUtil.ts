import uuidv1 from 'uuid/v1';
import {ImageData, UrlFile} from "../store/labels/types";
import {LabelsSelector} from "../store/selectors/LabelsSelector";

export class FileUtil {
    public static mapFileDataToImageData(fileData: File): ImageData {
        let currentBuildingMetadata =
          JSON.parse(JSON.stringify(LabelsSelector.getBuildingMetadata()));
        for (let i = 0; i < currentBuildingMetadata.footprint.length; ++i) {
            for (let j = 0; j < currentBuildingMetadata.footprint[i].vertices.length; ++j) {
                currentBuildingMetadata.footprint[i].vertices[j].isSelected = false;
            }
        }
        return {
            id: uuidv1(),
            fileData: fileData,
            loadStatus: false,
            labelRects: [],
            labelPoints: [],
            labelLines: [],
            labelPolygons: [],
	    buildingMetadata: {footprint: currentBuildingMetadata.footprint, associations: []},
            uploadResponse: "",
            annotationsResponse: "",
            associationsResponse: "",
            lastUploadedAssociations: [],
            isVisitedByObjectDetector: false,
            isVisitedByPoseDetector: false
        }
    }

    public static loadImage(fileData: File|UrlFile, onSuccess: (image:HTMLImageElement) => any, onFailure: () => any): any {
		return new Promise((resolve, reject) => {
		    let url = null;
		    if ( fileData instanceof File) {
			url = URL.createObjectURL(fileData);
		    } else {
			url = fileData.url;
		    }
            const image = new Image();
			image.src = url;
			image.onload = () => {
				onSuccess(image);
				resolve();
			};
			image.onerror = () => {
				onFailure();
				reject();
			};
		})

    }

    public static loadLabelsList(fileData: File, onSuccess: (labels:string[]) => any, onFailure: () => any) {
        const reader = new FileReader();
        reader.readAsText(fileData);
        reader.onloadend = function (evt: any) {
            const contents:string = evt.target.result;
            onSuccess(contents.split(/[\r\n]/));
        };
        reader.onerror = () => onFailure();
    }
}
