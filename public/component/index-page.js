import m from 'mithril' 
import http from '../service/http'
import DbList from './db-list'
import Component from './component'

export default class IndexPage extends Component {

	view () {
	    return (
	    	<div>
	    		<div class="w3-margin-top">
	    			Choose database from left side
	    		</div>
	    	</div>
	    );
	}

}


