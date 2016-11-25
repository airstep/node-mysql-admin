import m from 'mithril' 
import http from '../service/http'
import Alert from './alert'
import DbList from './db-list'

function controller() {
	var self = this
}

function view (ctrl) {

    return (
    	<div>
    		<div class="w3-margin-top">
    			Choose database from left side
    		</div>
    	</div>
    );
}

export default { view, controller }

