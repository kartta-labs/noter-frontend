import {IPoint, IGeoPoint} from "../interfaces/IPoint";
import {FootprintPolygon} from "../store/labels/types";
import {ISize} from "../interfaces/ISize";
import {EditorModel} from "../staticModels/EditorModel";
import {LabelsSelector} from "../store/selectors/LabelsSelector"

export class BuildingMetadataUtil {
    public static convertResponseToFootprint(response: any): FootprintPolygon[] {
        let footprint: FootprintPolygon[] = [];
        for (var i = 0; i < response.length; ++i) {
            let allVertices: IGeoPoint[] = [];
            for (var j = 0; j < response[i].length; ++j) {
                allVertices.push({x: response[i][j][0], y: response[i][j][1], isSelected: false, facadeId: null});
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

    public static resizeFootprint(normalizedFootprint: FootprintPolygon[], viewPortSize: ISize): FootprintPolygon[] {
        let footprint = JSON.parse(JSON.stringify(normalizedFootprint));
        let targetLength = viewPortSize.width > viewPortSize.height ? viewPortSize.height - 10 : viewPortSize.width - 10;
        let scaleFactor = Math.min((viewPortSize.height - 10) / EditorModel.normalizedFootprintSize.height,
                                   (viewPortSize.width - 10) / EditorModel.normalizedFootprintSize.width);
        let shiftOffset: IPoint = {x: 5, y: 5};
        // shift to center inside viewPort
        let shift = Math.abs((viewPortSize.width - viewPortSize.height) / 2)
        shiftOffset = viewPortSize.width > viewPortSize.height ?
            {x: shiftOffset.x + shift, y: shiftOffset.y} : {x: shiftOffset.x, y: shiftOffset.y + shift};
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
