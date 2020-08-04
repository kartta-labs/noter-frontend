import {updateWindowSize} from "../../store/general/actionCreators";
import {updateFootprint} from "../../store/labels/actionCreators";
import {ContextManager} from "../context/ContextManager";
import {store} from "../../index";
import {PlatformUtil} from "../../utils/PlatformUtil";
import {BuildingMetadataUtil} from "../../utils/BuildingMetadataUtil";
import {PlatformModel} from "../../staticModels/PlatformModel";
import {EventType} from "../../data/enums/EventType";
import axios from 'axios';

export class AppInitializer {
    public static inti():void {
        AppInitializer.handleResize();
        AppInitializer.detectDeviceParams();
        window.addEventListener(EventType.RESIZE, AppInitializer.handleResize);
        window.addEventListener(EventType.MOUSE_WHEEL, AppInitializer.disableGenericScrollZoom,{passive:false});
        window.addEventListener(EventType.KEY_DOWN, AppInitializer.disableUnwantedKeyBoardBehaviour);
        window.addEventListener(EventType.KEY_PRESS, AppInitializer.disableUnwantedKeyBoardBehaviour);
        ContextManager.init();
        AppInitializer.getFootprintAndImages();
    }

    private static getFootprintAndImages = () => {
        let search = window.location.search;
        let params = new URLSearchParams(search);
        let foo = params.get('query');
        console.log(foo);
        const response = JSON.parse('{ "data": { "candidates": [ { "type": "Feature", "id": "123", "properties": { "timestamp": "2019-11-20T14:22:32Z", "version": "2", "changeset": "190", "user": "test", "uid": "9", "addr:housenumber": "342", "addr:street": "west 18th street", "building": "yes", "building:levels": "5", "start_date": "1897", "id": "123" }, "geometry": { "type": "Polygon", "coordinates": [ [ [ -74.0024099, 40.7428779 ], [ -74.002488, 40.7429105 ], [ -74.0025594, 40.7428119 ], [ -74.0025571, 40.7427938 ], [ -74.0026132, 40.7427209 ], [ -74.0025569, 40.7426972 ], [ -74.0025007, 40.7427739 ], [ -74.0024832, 40.742779 ], [ -74.0024099, 40.7428779 ] ] ], "indices_of_front_coordinates": [ 0, 1 ] } } ] } }');

        store.dispatch(updateFootprint(BuildingMetadataUtil.convertResponseToFootprint(
            response.data.candidates[0].geometry.coordinates)));
        // send request to editor
let xmlBodyStr = `<?xml version="1.0" encoding="UTF-8"?>
<osm>
  <changeset>
    <tag k="comment" v="Just adding some streetnames"/>
  </changeset>
</osm>
`
let config = {
    headers: {'Content-Type': 'text/xml'},
    withCredentials: true
};
        //axios.put('http://localhost/e/api/0.6/changeset/create', xmlBodyStr, config)
        axios.get('http://localhost/e/api/0.6/way/1', config)
        .then(response => {
            console.log(response);
        })
        .catch(function (error) {
            console.log(error);
        });

    }

    private static handleResize = () => {
        store.dispatch(updateWindowSize({
            width: window.innerWidth,
            height: window.innerHeight
        }));
    };

    private static disableUnwantedKeyBoardBehaviour = (event: KeyboardEvent) => {
        if (PlatformModel.isMac && event.metaKey) {
            event.preventDefault();
        }

        if (["=", "+", "-"].includes(event.key)) {
            if (event.ctrlKey || (PlatformModel.isMac && event.metaKey)) {
                event.preventDefault();
            }
        }
    };

    private static disableGenericScrollZoom = (event: MouseEvent) => {
        if (event.ctrlKey || (PlatformModel.isMac && event.metaKey)) {
            event.preventDefault();
        }
    };

    private static detectDeviceParams = () => {
        const userAgent: string = window.navigator.userAgent;
        PlatformModel.mobileDeviceData = PlatformUtil.getMobileDeviceData(userAgent);
        PlatformModel.isMac = PlatformUtil.isMac(userAgent);
        PlatformModel.isSafari = PlatformUtil.isSafari(userAgent);
        PlatformModel.isFirefox = PlatformUtil.isFirefox(userAgent);
    };
}
