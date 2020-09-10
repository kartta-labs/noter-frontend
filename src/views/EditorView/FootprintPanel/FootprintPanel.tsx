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

import React from 'react';
import './FootprintPanel.scss';
import {ISize} from "../../../interfaces/ISize";
import {ImageData, LabelPoint, LabelRect, BuildingMetadata} from "../../../store/labels/types";
import {FileUtil} from "../../../utils/FileUtil";
import {AppState} from "../../../store";
import {connect} from "react-redux";
import {updateSelectdPoints} from "../../../store/labels/actionCreators";
import {ImageRepository} from "../../../logic/imageRepository/ImageRepository";
import {LabelType} from "../../../data/enums/LabelType";
import {PopupWindowType} from "../../../data/enums/PopupWindowType";
import {CanvasUtil} from "../../../utils/CanvasUtil";
import {RectUtil} from "../../../utils//RectUtil";
import {CustomCursorStyle} from "../../../data/enums/CustomCursorStyle";
import {ImageLoadManager} from "../../../logic/imageRepository/ImageLoadManager";
import {EventType} from "../../../data/enums/EventType";
import {EditorData} from "../../../data/EditorData";
import {EditorModel} from "../../../staticModels/EditorModel";
import {EditorActions} from "../../../logic/actions/EditorActions";
import {EditorUtil} from "../../../utils/EditorUtil";
import {ContextManager} from "../../../logic/context/ContextManager";
import {ContextType} from "../../../data/enums/ContextType";
import Scrollbars from 'react-custom-scrollbars';
import {ViewPortActions} from "../../../logic/actions/ViewPortActions";
import {PlatformModel} from "../../../staticModels/PlatformModel";
import LabelControlPanel from "../LabelControlPanel/LabelControlPanel";
import {IPoint} from "../../../interfaces/IPoint";
import {RenderEngineUtil} from "../../../utils/RenderEngineUtil";
import {LabelStatus} from "../../../data/enums/LabelStatus";
import {isEqual} from "lodash";
import {AIActions} from "../../../logic/actions/AIActions";
import {DrawUtil} from "../../../utils/DrawUtil";
import {BuildingMetadataUtil} from "../../../utils/BuildingMetadataUtil";
import {Settings} from "../../../settings/Settings";

interface IProps {
windowSize: ISize;
updateSelectdPoints: (polygonIndex: number, pointIndex: number) => any;
buildingMetadata: BuildingMetadata;
highlightedLabelId: string;
}

interface IState {
    viewPortSize: ISize
}

class FootprintPanel extends React.Component<IProps, IState> {

    constructor(props) {
        super(props);
        this.state = {
            viewPortSize: {
                width: 0,
                height: 0
            },
        };
    }

    public componentDidMount(): void {
    	this.mountEventListeners();
        this.drawFootprint();
    }

    public componentWillUnmount(): void {
        this.unmountEventListeners();
    }

    public componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<{}>, snapshot?: any): void {
    	this.drawFootprint();
    }

    private mountEventListeners() {
        window.addEventListener(EventType.MOUSE_UP, this.update);
    }

    private unmountEventListeners() {
        window.removeEventListener(EventType.MOUSE_UP, this.update);
    }
    
    private distanceBetweenPoints = (p1: IPoint, p2: IPoint) => {
        return Math.abs(Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y)));
    }
    
    private update = (event: MouseEvent) => {
        const mousePosition = CanvasUtil.getMousePositionOnCanvasFromEvent(event, EditorModel.canvasFootprint);
	if (RectUtil.isPointInside({x: 0, y: 0, width: EditorModel.canvasFootprint.width,
	   			    height: EditorModel.canvasFootprint.height}, mousePosition)) {
	   const {buildingMetadata} = this.props;
	   const footprint = buildingMetadata.footprint;
	   var miniDist = this.distanceBetweenPoints(mousePosition,
						     BuildingMetadataUtil.resizeOnePoint(footprint[0].vertices[0]));
	   var polygonIndex = 0, pointIndex = 0;
	   for (let i = 0; i < footprint.length; ++i) {
	       for (let j = 0; j < footprint[i].vertices.length; ++j) {
	       	   const dist = this.distanceBetweenPoints(mousePosition,
							   BuildingMetadataUtil.resizeOnePoint(footprint[i].vertices[j]));
	       	   if (dist < miniDist) {
		       miniDist = dist;
		       polygonIndex = i;
		       pointIndex = j;
		   }
	       }
	   }
	   if (miniDist < 6) {
	      this.props.updateSelectdPoints(polygonIndex, pointIndex);
	   }
	}
    }

    private drawFootprint = () => {
        // compute the size of canvas to use
	const footprintViewPortSize = this.calculateFootprintViewPortSize();
	// resize the canvas
	EditorModel.canvasFootprint.width = footprintViewPortSize.width;
	EditorModel.canvasFootprint.height = footprintViewPortSize.height;
	DrawUtil.clearCanvas(EditorModel.canvasFootprint);
	// resize the footprint properly before drawing it
	const {buildingMetadata} = this.props;
	// make sure the footprint data is available
	if (buildingMetadata.footprint.length == 0) {
	   console.log("footprint data is not ready yet!");
	   return;
	}
	const footprint = BuildingMetadataUtil.resizeFootprint(buildingMetadata.footprint, footprintViewPortSize);
	// draw each polygon in blue
	for (let i = 0; i < footprint.length; ++i) {
	    	DrawUtil.drawPolygon(EditorModel.canvasFootprint, footprint[i].vertices, 'blue', 3);
	}
	// draw all associated edges in red
	for (let i = 0; i < buildingMetadata.associations.length; ++i) {
	    const onePair = buildingMetadata.associations[i];
	    const polygonIndex = onePair.polygonIndex;
	    const associatedEdgePoints = [];
	    for (let j = 0; j < onePair.indices.length; ++j) {
	    	const pointIndex = onePair.indices[j];
	    	associatedEdgePoints.push(footprint[polygonIndex].vertices[pointIndex]);
	    }
	    DrawUtil.drawPolyline(EditorModel.canvasFootprint, associatedEdgePoints, 'red', 3);
	}
	// draw the associated edges for highligted image annotation in thicker red
	if (this.props.highlightedLabelId !== null) {
	   for (let i = 0; i < buildingMetadata.associations.length; ++i) {
	       const onePair = buildingMetadata.associations[i];
	       if (onePair.facadeId !== this.props.highlightedLabelId)
	           continue;
	       const polygonIndex = onePair.polygonIndex;
	       const associatedEdgePoints = [];
	       for (let j = 0; j < onePair.indices.length; ++j) {
	    	   const pointIndex = onePair.indices[j];
	    	   associatedEdgePoints.push(footprint[polygonIndex].vertices[pointIndex]);
	       }
	       DrawUtil.drawPolyline(EditorModel.canvasFootprint, associatedEdgePoints, 'red', 5);
	    }
	}
	// draw all the points in different colors properly
	for (let i = 0; i < footprint.length; ++i) {
	    for (let j = 0; j < footprint[i].vertices.length; ++j) {
	    	if (footprint[i].vertices[j].isSelected) {
	       	   DrawUtil.drawCircleWithFill(EditorModel.canvasFootprint, footprint[i].vertices[j], 6, 'red');
	       } else {
	       	   DrawUtil.drawCircleWithFill(EditorModel.canvasFootprint, footprint[i].vertices[j], 6, 'green');
	       }
	    }
	}
    }

    private calculateFootprintViewPortSize = (): ISize => {
    	const {windowSize} = this.props;
        if (windowSize) {
            const leftTabWidth = Settings.SIDE_NAVIGATION_BAR_WIDTH_OPEN_PX;
            return {
                width: leftTabWidth,
                height: (windowSize.height - Settings.TOP_NAVIGATION_BAR_HEIGHT_PX) / 2,
            }
        }
        else
            return null;
    };

    public render() {
        return (
            <div className="FootprintPanel" >
    	    	 <canvas
		 ref={ref => EditorModel.canvasFootprint = ref}
		 draggable={false}
      		 onContextMenu={(event: React.MouseEvent<HTMLCanvasElement>) => event.preventDefault()}
    		/>
	    </div>
        );
    }
}

const mapDispatchToProps = {
    updateSelectdPoints
};

const mapStateToProps = (state: AppState) => ({
    windowSize: state.general.windowSize,
    buildingMetadata: state.labels.buildingMetadata,
    highlightedLabelId: state.labels.highlightedLabelId
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(FootprintPanel);