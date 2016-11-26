import m from 'mithril' 
import http from '../service/http'
import Component from './component'

export default class TablePageBrowseRow extends Component {

	init() {
		var self = this
		self.row = self.props.row
		self.column = self.props.column
	}

	onrowdblclick (row, column) {
		// set edit mode true to show input
		row[column.Field]["_isEditing"] = true
	}

 	view () {

 		var self = this

		var toShow
		var input = <input
				type="text"
				value={self.row[self.column.Field]["data"]()}
				onchange={m.withAttr("value", self.row[self.column.Field]["data"])}
				style="width:100%;"
				/>

		if(self.row[self.column.Field]._isEditing) {
			toShow = input
		} else {
			toShow = self.row[self.column.Field]["data"]()
		}

	    return (
	    	<td
			ondblclick={self.onrowdblclick.bind(self, self.row, self.column)}
			>
	    		{toShow}
	    		
	    	</td>
	    );
	}
}

