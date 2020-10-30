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
import {BuildingMetadata} from "../../../store/labels/types";
import {AppState} from "../../../store";
import {connect} from "react-redux";
import {updateSelectdPoints} from "../../../store/labels/actionCreators";
import {CanvasUtil} from "../../../utils/CanvasUtil";
import {RectUtil} from "../../../utils//RectUtil";
import {EventType} from "../../../data/enums/EventType";
import {EditorModel} from "../../../staticModels/EditorModel";
import {IPoint} from "../../../interfaces/IPoint";
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

    private distanceToLineSegment = (p: IPoint, p1: IPoint, p2: IPoint) => {
        return Math.abs((p2.y - p1.y)*p.x - (p2.x - p1.x)*p.y + p2.x*p1.y - p2.y*p1.x) / this.distanceBetweenPoints(p1, p2);
    }

    private distanceToSegmentEnds = (p: IPoint, p1: IPoint, p2: IPoint) => {
        return this.distanceBetweenPoints(p, p1) + this.distanceBetweenPoints(p, p2);
    }

    private isInsideSegment = (p: IPoint, p1: IPoint, p2: IPoint) => {
    	const dx = p1.x - p2.x;
    	const dy = p1.y - p2.y;
    	const innerProduct = (p.x - p2.x)*dx + (p.y - p2.y)*dy;
    	return 0 <= innerProduct && innerProduct <= dx*dx + dy*dy;
    }

    private isAssociated(buildingMetadata, polyIndex: number, index: number) {
    	var found = false;
	for (let i = 0; i < buildingMetadata.associations.length; ++i) {
	    const onePair = buildingMetadata.associations[i];
	    const polygonIndex = onePair.polygonIndex;
	    if (polygonIndex !== polyIndex) {
	        continue;
	    }
	    for (let j = 0; j < onePair.indices.length; ++j) {
	    	const pointIndex = onePair.indices[j];
	    	if (pointIndex === index) {
		  found = true;
		}
	    }
	}
	return found;
    }
    private update = (event: MouseEvent) => {
        const mousePosition = CanvasUtil.getMousePositionOnCanvasFromEvent(event, EditorModel.canvasFootprint);
	if (RectUtil.isPointInside({x: 0, y: 0, width: EditorModel.canvasFootprint.width,
	   			    height: EditorModel.canvasFootprint.height}, mousePosition)) {
	   const {buildingMetadata} = this.props;
	   const footprint = buildingMetadata.footprint;
	   var miniDist = -1.0;
	   // here each line is represneted by its starting index (e.g. 0 reprents the line [0, 1])
	   var polygonIndex = 0, pointIndex = 0;
	   var foundCloseEnough = false;
	   for (let i = 0; i < footprint.length; ++i) {
	       for (let j = 0; j < footprint[i].vertices.length; ++j) {
	           const next = (j+1) % footprint[i].vertices.length;
	           // first check if this line has been associated or not
		   if (this.isAssociated(buildingMetadata, polygonIndex, j)) {
		       continue;
		   }
		   const p1 = BuildingMetadataUtil.resizeOnePoint(footprint[i].vertices[j]);
		   const p2 = BuildingMetadataUtil.resizeOnePoint(footprint[i].vertices[next]);
		   // second check if the mouse point is inside the current footprint side
		   if (!this.isInsideSegment(mousePosition, p1, p2)) {
		   	continue;
		   }
		   // find the closest one as the target
	       	   const penpendicularDist = this.distanceToLineSegment(mousePosition, p1, p2);
		   if (penpendicularDist < 6) {
		     foundCloseEnough = true;
		     const dist = this.distanceToSegmentEnds(mousePosition, p1, p2);
	       	     if (miniDist < 0 || dist < miniDist) {
		       miniDist = dist;
		       polygonIndex = i;
		       pointIndex = j;
		     }
		   }
	       }
	   }
	   if (foundCloseEnough) {
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
	if (buildingMetadata.footprint.length === 0) {
	   console.log("footprint data is not ready yet!");
	   return;
	}
	const footprint = BuildingMetadataUtil.resizeFootprint(buildingMetadata.footprint, footprintViewPortSize);
	// draw each polygon in blue
	for (let i = 0; i < footprint.length; ++i) {
	    	DrawUtil.drawPolygon(EditorModel.canvasFootprint, footprint[i].vertices, 'blue', 3);
	}
	// draw all the selected edges in green (will further overwritten as red if it's associated with facade)
	for (let i = 0; i < footprint.length; ++i) {
	    for (let j = 0; j < footprint[i].vertices.length; ++j) {
	    	if (footprint[i].vertices[j].isSelected) {
		   const nextIndex = (j + 1) % footprint[i].vertices.length;
	       	   DrawUtil.drawLine(EditorModel.canvasFootprint, footprint[i].vertices[j], footprint[i].vertices[nextIndex],
		                     'green', 3);
	       }
	    }
	}
	// draw all associated edges in red
	for (let i = 0; i < buildingMetadata.associations.length; ++i) {
	    const onePair = buildingMetadata.associations[i];
	    const polygonIndex = onePair.polygonIndex;
	    for (let j = 0; j < onePair.indices.length; ++j) {
	    	const pointIndex = onePair.indices[j];
		const nextIndex = (pointIndex + 1) % footprint[polygonIndex].vertices.length;
		DrawUtil.drawLine(EditorModel.canvasFootprint,
	    		footprint[polygonIndex].vertices[pointIndex],
			footprint[polygonIndex].vertices[nextIndex], 'yellow', 3);
	    }
	}
	// draw the associated edges for highligted image annotation in thicker red
	if (this.props.highlightedLabelId !== null) {
	   for (let i = 0; i < buildingMetadata.associations.length; ++i) {
	       const onePair = buildingMetadata.associations[i];
	       if (onePair.facadeId !== this.props.highlightedLabelId)
	           continue;
	       const polygonIndex = onePair.polygonIndex;
	       for (let j = 0; j < onePair.indices.length; ++j) {
	    	   const pointIndex = onePair.indices[j];
		   const nextIndex = (pointIndex + 1) % footprint[polygonIndex].vertices.length;
	    	   DrawUtil.drawLine(EditorModel.canvasFootprint,
	    		footprint[polygonIndex].vertices[pointIndex],
			footprint[polygonIndex].vertices[nextIndex], 'red', 5);
	       }
	    }
	}
        // draw all the vertices to split the edges
        for (let i = 0; i < footprint.length; ++i) {
            for (let j = 0; j < footprint[i].vertices.length; ++j) {
            	DrawUtil.drawCircleWithFill(EditorModel.canvasFootprint, footprint[i].vertices[j], 3, 'white');
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
