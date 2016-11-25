import m from 'mithril' 
import http from '../service/http'
import Alert from './alert'

function controller(attrs) {

	var self = this
	self.row = attrs.row
	self.column = attrs.column

	self.onrowdblclick = function (row, column) {

		// set edit mode true to show input
		row[column.Field]["_isEditing"] = true
		console.log(row)

		m.redraw()
	}

}

function view (ctrl) {

	var toShow
	var input = <input
			type="text"
			value={ctrl.row[ctrl.column.Field]["data"]()}
			onchange={m.withAttr("value", ctrl.row[ctrl.column.Field]["data"])}
			style="width:100%;"
			/>

	if(ctrl.row[ctrl.column.Field]._isEditing) {
		toShow = input
	} else {
		toShow = ctrl.row[ctrl.column.Field]["data"]()
	}

    return (
    	<td
		ondblclick={ctrl.onrowdblclick.bind(ctrl, ctrl.row, ctrl.column)}
		>
    		{toShow}
    		
    	</td>
    );
}

export default { view, controller }

